import hashlib
import json
from datetime import datetime, timedelta, timezone

from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

import logging
logger = logging.getLogger(__name__)

from services.alert_engine.rules import should_alert
from services.alert_engine.wallet_names import resolve_wallet_name
from services.trade_ingest.markets import resolve_market_title
from shared.config import settings, get_alert_config, parse_duration
from shared.models import Alert, Market, WhaleTrade, WhaleTradeHistory


def _id(whale_trade_id: str) -> str:
  return hashlib.sha1(f"al:{whale_trade_id}".encode("utf-8")).hexdigest()[:32]


async def get_market_question(session: AsyncSession, market_id: str) -> str | None:
  mid = str(market_id or "")
  if not mid:
    return None
  row = (await session.execute(select(Market).where(Market.id == mid))).scalars().first()
  if not row:
    return None
  return row.title


async def _can_alert_event(session: AsyncSession, redis: Redis, market_id: str, wallet: str, now: datetime, usd: float) -> bool:
  config = get_alert_config()
  cooldown = config.get("cooldown_settings", {})
  same_wallet_seconds = parse_duration(cooldown.get("same_wallet_same_market"), settings.alert_cooldown_seconds)
  different_wallet_seconds = parse_duration(cooldown.get("same_market_different_wallet"), 0)
  increased_position_seconds = parse_duration(cooldown.get("increased_position"), same_wallet_seconds)

  key_wallet = f"cooldown:{wallet}:{market_id}"
  cached = await redis.get(key_wallet)
  if cached:
    try:
      data = json.loads(cached)
      last_usd = float(data.get("last_usd") or 0)
      last_at_raw = data.get("last_at")
      last_at = datetime.fromisoformat(last_at_raw) if last_at_raw else None
      if last_at and last_at.tzinfo is None:
        last_at = last_at.replace(tzinfo=timezone.utc)
    except Exception:
      last_usd = 0.0
      last_at = None
    if last_usd <= 0 or not last_at:
      return False
    elapsed = (now - last_at).total_seconds()
    if elapsed >= increased_position_seconds and usd >= last_usd:
      return True
    return usd >= 2 * last_usd

  if different_wallet_seconds > 0:
    market_key = f"cooldown_market:{market_id}"
    market_cached = await redis.get(market_key)
    if market_cached:
      try:
        data = json.loads(market_cached)
        last_wallet = str(data.get("last_wallet") or "").lower()
      except Exception:
        last_wallet = ""
      if last_wallet and last_wallet != str(wallet or "").lower():
        return False

  window_start = now - timedelta(seconds=same_wallet_seconds)
  row = (
    await session.execute(
      select(Alert)
      .where(Alert.market_id == market_id)
      .where(Alert.wallet_address == wallet)
      .where(Alert.created_at >= window_start)
      .order_by(Alert.created_at.desc())
      .limit(1)
    )
  ).scalars().first()
  if not row:
    if different_wallet_seconds <= 0:
      return True
    diff_start = now - timedelta(seconds=different_wallet_seconds)
    diff_row = (
      await session.execute(
        select(Alert)
        .where(Alert.market_id == market_id)
        .where(Alert.created_at >= diff_start)
        .order_by(Alert.created_at.desc())
        .limit(1)
      )
    ).scalars().first()
    if not diff_row:
      return True
    return str(diff_row.wallet_address or "").lower() == str(wallet or "").lower()
  last_usd: float | None = None
  try:
    last_trade_id = (
      await session.execute(select(WhaleTrade.trade_id).where(WhaleTrade.id == row.whale_trade_id))
    ).scalars().first()
    if last_trade_id:
      last_usd = (
        await session.execute(select(WhaleTradeHistory.trade_usd).where(WhaleTradeHistory.trade_id == last_trade_id))
      ).scalars().first()
  except Exception:
    last_usd = None
  if last_usd is None:
    return False
  last_at = row.created_at
  if last_at and (now - last_at).total_seconds() >= increased_position_seconds and usd >= float(last_usd):
    return True
  return usd >= 2 * float(last_usd)


def infer_alert_type(side: str) -> str:
  s = (side or "").lower()
  if s == "sell":
    return "whale_exit"
  return "whale_entry"


async def process_whale_trade_event(session: AsyncSession, redis: Redis, event: dict) -> bool:
  whale_trade_id = str(event.get("whale_trade_id") or "")
  if not whale_trade_id:
    return False
  raw_token_id = str(event.get("market_id") or "")
  wallet = str(event.get("wallet_address") or "")
  score = int(event.get("whale_score") or 0)
  usd = float(event.get("trade_usd") or 0)

  logger.info(f"DEBUG: process_whale_trade_event score={score}, usd={usd}")
  config = get_alert_config()
  thresholds = config.get("alert_thresholds", {})
  confidence = thresholds.get("confidence_scores", {})
  usd_thresholds = thresholds.get("usd_thresholds", {})
  min_score = int(confidence.get("medium_confidence", settings.alert_min_score))
  min_usd = float(usd_thresholds.get("medium", settings.alert_min_trade_usd))
  always_score = int(confidence.get("high_confidence", settings.alert_always_score))
  d = should_alert(
    whale_score=score,
    trade_usd=usd,
    min_score=min_score,
    min_usd=min_usd,
    always_score=always_score,
  )
  signal_level = str(event.get("signal_level") or d.signal_level or "high")
  logger.info(f"DEBUG: should_alert decision={d}")
  if not d.should_alert:
    return False

  now = datetime.now(timezone.utc)
  wallet_name = await resolve_wallet_name(session, wallet)
  can_alert = await _can_alert_event(session, redis, raw_token_id, wallet, now, usd)
  logger.info(f"DEBUG: can_alert_event={can_alert}")
  if not can_alert:
    return False

  a_type = infer_alert_type(str(event.get("side") or ""))
  action_type = str(event.get("action_type") or "")
  if signal_level == "low":
    logger.info("signal_level=low_confidence whale_trade_id=%s wallet=%s market=%s", whale_trade_id, wallet, raw_token_id)
  alert = Alert(
    id=_id(whale_trade_id),
    whale_trade_id=whale_trade_id,
    market_id=raw_token_id,
    wallet_address=wallet,
    whale_score=score,
    alert_type=a_type,
    created_at=now,
  )
  result = await session.execute(
    insert(Alert)
    .values(
      id=alert.id,
      whale_trade_id=alert.whale_trade_id,
      market_id=alert.market_id,
      wallet_address=alert.wallet_address,
      whale_score=alert.whale_score,
      alert_type=alert.alert_type,
      created_at=alert.created_at,
    )
    .on_conflict_do_nothing(index_elements=[Alert.whale_trade_id])
  )
  created = result.rowcount == 1
  logger.info(f"DEBUG: alert created={created}")
  if created:
    config = get_alert_config()
    cooldown = config.get("cooldown_settings", {})
    same_wallet_seconds = parse_duration(cooldown.get("same_wallet_same_market"), settings.alert_cooldown_seconds)
    different_wallet_seconds = parse_duration(cooldown.get("same_market_different_wallet"), 0)
    increased_position_seconds = parse_duration(cooldown.get("increased_position"), same_wallet_seconds)
    wallet_ttl = max(int(same_wallet_seconds), int(increased_position_seconds))
    await redis.set(
      f"cooldown:{wallet}:{raw_token_id}",
      json.dumps({"last_usd": usd, "last_at": now.isoformat()}),
      ex=wallet_ttl,
    )
    if different_wallet_seconds > 0:
      await redis.set(
        f"cooldown_market:{raw_token_id}",
        json.dumps({"last_wallet": wallet, "last_at": now.isoformat()}),
        ex=int(different_wallet_seconds),
      )
    market_question = await get_market_question(session, raw_token_id)
    market_title = market_question
    if not market_question:
      title = await resolve_market_title(session, raw_token_id)
      if title:
        await session.execute(
          insert(Market)
          .values(id=raw_token_id, title=title, status="active", created_at=now)
          .on_conflict_do_update(index_elements=[Market.id], set_={"title": title})
        )
        market_question = title
        market_title = title
      else:
        market_question = f"Market ({raw_token_id})"
        market_title = None
    payload = {
      "alert_id": alert.id,
      "whale_trade_id": whale_trade_id,
      "market_id": raw_token_id,
      "raw_token_id": raw_token_id,
      "wallet_address": wallet,
      "wallet_name": wallet_name,
      "whale_score": score,
      "alert_type": a_type,
      "action_type": action_type,
      "behavior": event.get("behavior"),
      "market_question": market_question,
      "market_title": market_title,
      "outcome": event.get("outcome"),
      "side": event.get("side") or "UNKNOWN",
      "size": usd,
      "price": event.get("price"),
      "signal_level": signal_level,
      "created_at": now.isoformat(),
    }
    await redis.rpush(settings.alert_created_queue, json.dumps(payload))
  return created
