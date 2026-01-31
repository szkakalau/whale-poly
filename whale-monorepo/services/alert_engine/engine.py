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
from services.trade_ingest.markets import resolve_market_title
from shared.config import settings
from shared.models import Alert, Market, MarketAlertState


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


async def _can_alert_market(session: AsyncSession, market_id: str, now: datetime) -> bool:
  row = (await session.execute(select(MarketAlertState).where(MarketAlertState.market_id == market_id))).scalars().first()
  if not row:
    return True
  last = row.last_alert_at
  if last.tzinfo is None:
    last = last.replace(tzinfo=timezone.utc)
  return (now - last) >= timedelta(seconds=settings.alert_cooldown_seconds)


async def _touch_market(session: AsyncSession, market_id: str, now: datetime) -> None:
  await session.execute(
    insert(MarketAlertState)
    .values(market_id=market_id, last_alert_at=now)
    .on_conflict_do_update(index_elements=[MarketAlertState.market_id], set_={"last_alert_at": now})
  )


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
  d = should_alert(
    whale_score=score,
    trade_usd=usd,
    min_score=settings.alert_min_score,
    min_usd=settings.alert_min_trade_usd,
    always_score=settings.alert_always_score,
  )
  logger.info(f"DEBUG: should_alert decision={d}")
  if not d.should_alert:
    return False

  now = datetime.now(timezone.utc)
  can_alert = await _can_alert_market(session, raw_token_id, now)
  logger.info(f"DEBUG: can_alert_market={can_alert}")
  if not can_alert:
    return False

  a_type = infer_alert_type(str(event.get("side") or ""))
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
    await _touch_market(session, raw_token_id, now)
    market_question = await get_market_question(session, raw_token_id)
    if not market_question:
      title = await resolve_market_title(session, raw_token_id)
      if title:
        await session.execute(
          insert(Market)
          .values(id=raw_token_id, title=title, status="active", created_at=now)
          .on_conflict_do_update(index_elements=[Market.id], set_={"title": title})
        )
        market_question = title
      else:
        market_question = f"Market ({raw_token_id})"
    payload = {
      "alert_id": alert.id,
      "whale_trade_id": whale_trade_id,
      "market_id": raw_token_id,
      "raw_token_id": raw_token_id,
      "wallet_address": wallet,
      "whale_score": score,
      "alert_type": a_type,
      "market_question": market_question,
      "side": event.get("side") or "UNKNOWN",
      "size": usd,
      "price": event.get("price"),
      "created_at": now.isoformat(),
    }
    await redis.rpush(settings.alert_created_queue, json.dumps(payload))
  return created
