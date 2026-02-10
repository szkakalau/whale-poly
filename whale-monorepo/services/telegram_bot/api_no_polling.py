import asyncio
import hashlib
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import httpx
from fastapi import FastAPI, Header, HTTPException, Query
from redis.asyncio import Redis
from sqlalchemy import func, or_, select, text
from sqlalchemy.dialects.postgresql import insert
from urllib.parse import urlparse

from services.telegram_bot.bot import build_application
from services.telegram_bot.templates import format_alert
from services.telegram_bot.rate_limit import allow_send, check_daily_alert_limit, increment_daily_alert_count
from shared.config import settings, get_alert_config, parse_duration
from shared.db import SessionLocal
from shared.logging import configure_logging
from shared.models import (
  Delivery,
  Subscription,
  Collection,
  CollectionWhale,
  SmartCollection,
  SmartCollectionWhale,
  SmartCollectionSubscription,
  User,
  WhaleFollow,
)


configure_logging(settings.log_level)
logger = logging.getLogger("telegram_bot.api")

_HAS_USERS_TABLE: bool | None = None
_HAS_WHALE_FOLLOWS_TABLE: bool | None = None


def _is_missing_users_error(e: Exception) -> bool:
  msg = str(e).lower()
  return ('relation "users" does not exist' in msg) or ("undefinedtableerror" in msg)


def _mark_users_table_missing() -> None:
  global _HAS_USERS_TABLE
  _HAS_USERS_TABLE = False


async def _has_users_table(session) -> bool:
  global _HAS_USERS_TABLE
  if _HAS_USERS_TABLE is not None:
    return _HAS_USERS_TABLE
  try:
    _HAS_USERS_TABLE = bool((await session.execute(text("select to_regclass('public.users')"))).scalar_one_or_none())
  except Exception:
    _HAS_USERS_TABLE = False
  return _HAS_USERS_TABLE


def _is_missing_whale_follows_error(e: Exception) -> bool:
  msg = str(e).lower()
  return ('relation "whale_follows" does not exist' in msg) or ("undefinedtableerror" in msg)


def _mark_whale_follows_table_missing() -> None:
  global _HAS_WHALE_FOLLOWS_TABLE
  _HAS_WHALE_FOLLOWS_TABLE = False


async def _has_whale_follows_table(session) -> bool:
  global _HAS_WHALE_FOLLOWS_TABLE
  if _HAS_WHALE_FOLLOWS_TABLE is not None:
    return _HAS_WHALE_FOLLOWS_TABLE
  try:
    _HAS_WHALE_FOLLOWS_TABLE = bool((await session.execute(text("select to_regclass('public.whale_follows')"))).scalar_one_or_none())
  except Exception:
    _HAS_WHALE_FOLLOWS_TABLE = False
  return _HAS_WHALE_FOLLOWS_TABLE


def _redact_netloc(url: str) -> str:
  try:
    u = urlparse(url)
    if not u.netloc:
      return ""
    if "@" in u.netloc:
      return u.netloc.split("@", 1)[1]
    return u.netloc
  except Exception:
    return ""


def _require_admin(x_admin_token: str | None) -> None:
  if not settings.admin_token or not x_admin_token or x_admin_token != settings.admin_token:
    raise HTTPException(status_code=404, detail="not_found")


def _hash_admin(value: str) -> str:
  return hashlib.sha1(f"admin:{value}".encode("utf-8")).hexdigest()[:10]


async def _log_subscriber_stats_forever(stop: asyncio.Event) -> None:
  while not stop.is_set():
    try:
      now = datetime.now(timezone.utc)
      async with SessionLocal() as session:
        total = (await session.execute(select(func.count()).select_from(Subscription))).scalar_one()
        active = (
          await session.execute(
            select(func.count())
            .select_from(Subscription)
            .where(Subscription.status.in_(["active", "trialing"]))
            .where(Subscription.current_period_end > now)
          )
        ).scalar_one()
      logger.info("subscription_stats total=%s active_now=%s", int(total), int(active))
    except Exception:
      logger.exception("subscription_stats_failed")

    try:
      await asyncio.wait_for(stop.wait(), timeout=600)
    except asyncio.TimeoutError:
      continue


async def consume_alerts_forever(stop: asyncio.Event, redis: Redis, application) -> None:
  global _HAS_USERS_TABLE
  while not stop.is_set():
    item = await redis.blpop(settings.alert_created_queue, timeout=1)
    if not item:
      continue
    _, raw = item
    try:
      payload = json.loads(raw)
    except Exception:
      continue

    whale_trade_id = str(payload.get("whale_trade_id") or "")
    if not whale_trade_id:
      continue

    now = datetime.now(timezone.utc)
    wallet_address = str(payload.get("wallet_address") or "")
    wallet = wallet_address.lower()
    alert_type = str(payload.get("alert_type") or "")
    action_type = str(payload.get("action_type") or "")
    whale_score = payload.get("whale_score")
    size = payload.get("size")

    def _safe_float(x) -> float | None:
      try:
        v = float(x)
      except Exception:
        return None
      if v != v:
        return None
      return v

    score_v = _safe_float(whale_score) or 0.0
    size_v = _safe_float(size) or 0.0

    kind = (action_type or "").lower()
    if not kind:
      if (alert_type or "").lower() == "whale_exit":
        kind = "exit"
      else:
        kind = "entry"

    telegram_ids: list[str] = []
    lookup_db_ok = False
    recipient_plan_map: dict[str, str] = {}

    config = get_alert_config()
    plan_cfg = config.get("user_plans", {})

    def _plan_limits(name: str, default_delay_minutes: int, default_max_alerts):
      data = plan_cfg.get(name, {})
      delay_seconds = parse_duration(data.get("alerts_delay"), default_delay_minutes * 60)
      delay_minutes = int(delay_seconds / 60)
      max_alerts = data.get("max_alerts_per_day", default_max_alerts)
      return {"max_alerts_per_day": max_alerts, "alert_delay_minutes": delay_minutes}

    PLAN_LIMITS_MAP = {
      "FREE": _plan_limits("free", 10, 3),
      "PRO": _plan_limits("pro", 0, "unlimited"),
      "ELITE": _plan_limits("elite", 0, "unlimited"),
    }

    async def _send_with_rules(tid: str, p_raw: str, p_json: dict, p_plan_map: dict):
      plan_name = p_plan_map.get(tid, "FREE").upper()
      limits = PLAN_LIMITS_MAP.get(plan_name, PLAN_LIMITS_MAP["FREE"])
      signal_level = (p_json.get("signal_level") or "").lower()
      behavior = p_json.get("behavior")
      score_value = _safe_float(p_json.get("whale_score") or p_json.get("score")) or 0.0
      size_value = _safe_float(p_json.get("size") or p_json.get("amount")) or 0.0
      thresholds = config.get("alert_thresholds", {})
      confidence = thresholds.get("confidence_scores", {})
      usd_thresholds = thresholds.get("usd_thresholds", {})
      high_score = float(confidence.get("high_confidence", 85))
      high_usd = float(usd_thresholds.get("high", 400))
      high_confidence = (score_value >= high_score and size_value >= high_usd) or bool(behavior)
      market_id = str(p_json.get("market_id") or p_json.get("raw_token_id") or "")
      wallet_value = str(p_json.get("wallet_address") or "").lower()
      
      # 1. Check Daily Limit
      if not await check_daily_alert_limit(redis, tid, limits["max_alerts_per_day"]):
        logger.warning("daily_limit_reached telegram_id=%s plan=%s", tid, plan_name)
        return False

      # 2. Check Rate Limit (Fanout)
      if not await allow_send(redis, tid, settings.alert_fanout_rate_limit_per_minute):
        await redis.rpush(settings.alert_created_queue, p_raw)
        return False

      if plan_name == "PRO" and not high_confidence:
        return False

      elite_priority_key = f"elite:last:{tid}"
      elite_same_focus = False
      if plan_name == "ELITE" and market_id and wallet_value:
        last_focus = await redis.get(elite_priority_key)
        elite_same_focus = last_focus == f"{wallet_value}|{market_id}"

      # 3. Handle Delay for FREE users
      delay_min = limits["alert_delay_minutes"]
      delay_seconds = delay_min * 60
      if plan_name == "ELITE" and signal_level == "low" and not elite_same_focus:
        delay_seconds = max(delay_seconds, 60)
      if delay_seconds > 0:
        # If it's a delayed message, we need to schedule it
        async def _delayed_send():
          try:
            await asyncio.sleep(delay_seconds)
            await application.bot.send_message(
              chat_id=int(tid),
              text=format_alert(p_json, tid),
              parse_mode="HTML",
              disable_web_page_preview=True,
            )
            await increment_daily_alert_count(redis, tid)
            if plan_name == "ELITE" and market_id and wallet_value:
              await redis.set(elite_priority_key, f"{wallet_value}|{market_id}", ex=12 * 3600)
          except Exception:
            logger.exception("delayed_telegram_send_failed telegram_id=%s", tid)
        
        asyncio.create_task(_delayed_send())
        return True

      # 4. Immediate Send for PRO/ELITE
      try:
        await application.bot.send_message(
          chat_id=int(tid),
          text=format_alert(p_json, tid),
          parse_mode="HTML",
          disable_web_page_preview=True,
        )
        await increment_daily_alert_count(redis, tid)
        if plan_name == "ELITE" and market_id and wallet_value:
          await redis.set(elite_priority_key, f"{wallet_value}|{market_id}", ex=12 * 3600)
        return True
      except Exception:
        logger.exception("telegram_send_failed telegram_id=%s whale_trade_id=%s", tid, whale_trade_id)
        return False

    try:
      async with SessionLocal() as session:
        has_users = await _has_users_table(session)
        has_follows = await _has_whale_follows_table(session)
        async def _lookup_ids(has_users_flag: bool) -> tuple[dict[str, str], dict[str, str], dict[str, str]]:
          follow_map_v: dict[str, str] = {}
          if has_follows:
            if has_users_flag:
              user_join = or_(User.telegram_id == Subscription.telegram_id, User.id == Subscription.telegram_id)
              follow_query = (
                select(Subscription.telegram_id, User.plan)
                .join(User, user_join)
                .join(WhaleFollow, WhaleFollow.user_id == User.id)
                .where(Subscription.status.in_(["active", "trialing"]))
                .where(Subscription.current_period_end > now)
                .where(WhaleFollow.enabled.is_(True))
                .where(WhaleFollow.wallet == wallet)
                .where(WhaleFollow.min_size <= size_v)
                .where(WhaleFollow.min_score <= score_v)
              )
            else:
              follow_query = (
                select(Subscription.telegram_id, Subscription.plan)
                .join(WhaleFollow, WhaleFollow.user_id == Subscription.telegram_id)
                .where(Subscription.status.in_(["active", "trialing"]))
                .where(Subscription.current_period_end > now)
                .where(WhaleFollow.enabled.is_(True))
                .where(WhaleFollow.wallet == wallet)
                .where(WhaleFollow.min_size <= size_v)
                .where(WhaleFollow.min_score <= score_v)
              )
            if kind == "exit":
              follow_query = follow_query.where(WhaleFollow.alert_exit.is_(True))
            elif kind == "add":
              follow_query = follow_query.where(WhaleFollow.alert_add.is_(True))
            else:
              follow_query = follow_query.where(WhaleFollow.alert_entry.is_(True))
            try:
              rows = (await session.execute(follow_query)).all()
              for r in rows:
                follow_map_v[str(r[0])] = str(r[1]).upper()
            except Exception as e:
              if _is_missing_whale_follows_error(e):
                _mark_whale_follows_table_missing()
              else:
                raise

          if has_users_flag:
            user_join = or_(User.telegram_id == Subscription.telegram_id, User.id == Subscription.telegram_id)
            collection_query = (
              select(Subscription.telegram_id, User.plan)
              .join(User, user_join)
              .join(Collection, Collection.user_id == User.id)
              .join(CollectionWhale, CollectionWhale.collection_id == Collection.id)
              .where(Subscription.status.in_(["active", "trialing"]))
              .where(Subscription.current_period_end > now)
              .where(Collection.enabled.is_(True))
              .where(CollectionWhale.wallet == wallet)
            )
          else:
            collection_query = (
              select(Subscription.telegram_id, Subscription.plan)
              .join(Collection, Collection.user_id == Subscription.telegram_id)
              .join(CollectionWhale, CollectionWhale.collection_id == Collection.id)
              .where(Subscription.status.in_(["active", "trialing"]))
              .where(Subscription.current_period_end > now)
              .where(Collection.enabled.is_(True))
              .where(CollectionWhale.wallet == wallet)
            )
          collection_map_v: dict[str, str] = {}
          rows = (await session.execute(collection_query)).all()
          for r in rows:
            collection_map_v[str(r[0])] = str(r[1]).upper()

          if has_users_flag:
            user_join = or_(User.telegram_id == Subscription.telegram_id, User.id == Subscription.telegram_id)
            smart_query = (
              select(Subscription.telegram_id, User.plan)
              .join(User, user_join)
              .join(SmartCollectionSubscription, SmartCollectionSubscription.user_id == User.id)
              .join(SmartCollection, SmartCollection.id == SmartCollectionSubscription.smart_collection_id)
              .join(SmartCollectionWhale, SmartCollectionWhale.smart_collection_id == SmartCollection.id)
              .where(Subscription.status.in_(["active", "trialing"]))
              .where(Subscription.current_period_end > now)
              .where(SmartCollection.enabled.is_(True))
              .where(SmartCollectionWhale.wallet == wallet)
            )
          else:
            smart_query = (
              select(Subscription.telegram_id, Subscription.plan)
              .join(SmartCollectionSubscription, SmartCollectionSubscription.user_id == Subscription.telegram_id)
              .join(SmartCollection, SmartCollection.id == SmartCollectionSubscription.smart_collection_id)
              .join(SmartCollectionWhale, SmartCollectionWhale.smart_collection_id == SmartCollection.id)
              .where(Subscription.status.in_(["active", "trialing"]))
              .where(Subscription.current_period_end > now)
              .where(SmartCollection.enabled.is_(True))
              .where(SmartCollectionWhale.wallet == wallet)
            )
          smart_map_v: dict[str, str] = {}
          rows = (await session.execute(smart_query)).all()
          for r in rows:
            smart_map_v[str(r[0])] = str(r[1]).upper()
          return follow_map_v, collection_map_v, smart_map_v

        try:
          follow_map, collection_map, smart_map = await _lookup_ids(has_users)
        except Exception as e:
          if has_users and _is_missing_users_error(e):
            _mark_users_table_missing()
            follow_map, collection_map, smart_map = await _lookup_ids(False)
          else:
            raise

        recipient_plan_map = {**follow_map, **collection_map, **smart_map}
        telegram_ids = list(recipient_plan_map.keys())
        lookup_db_ok = True
    except Exception:
      logger.exception("subscriber_lookup_failed")
      telegram_ids = []
      lookup_db_ok = False

    if settings.telegram_alert_chat_id:
      telegram_ids = list(dict.fromkeys([*telegram_ids, settings.telegram_alert_chat_id]))

    if not telegram_ids:
      continue

    if not lookup_db_ok:
      for tid in telegram_ids:
        if not await allow_send(redis, tid, settings.alert_fanout_rate_limit_per_minute):
          await redis.rpush(settings.alert_created_queue, raw)
          break
        try:
          await application.bot.send_message(
            chat_id=int(tid),
            text=format_alert(payload, tid),
            parse_mode="HTML",
            disable_web_page_preview=True,
          )
        except Exception:
          logger.exception("telegram_send_failed telegram_id=%s whale_trade_id=%s", tid, whale_trade_id)
      continue

    try:
      async with SessionLocal() as session:
        for tid in telegram_ids:
          # If lookup was OK, use plan-aware sending rules
          if not await _send_with_rules(tid, raw, payload, recipient_plan_map):
            continue

          try:
            await session.execute(
              insert(Delivery)
              .values(telegram_id=tid, whale_trade_id=whale_trade_id)
              .on_conflict_do_nothing(index_elements=["telegram_id", "whale_trade_id"])
            )
          except Exception:
            logger.exception("delivery_record_failed telegram_id=%s whale_trade_id=%s", tid, whale_trade_id)
        await session.commit()
      logger.info("alert_dispatched whale_trade_id=%s recipients=%s", whale_trade_id, len(telegram_ids))
    except Exception:
      logger.exception("delivery_dispatch_failed whale_trade_id=%s", whale_trade_id)


@asynccontextmanager
async def lifespan(_: FastAPI):
  stop = asyncio.Event()
  redis = Redis.from_url(settings.redis_url, decode_responses=True)
  await redis.ping()
  logger.info(
    "redis_connected host=%s queue=%s",
    _redact_netloc(settings.redis_url),
    settings.alert_created_queue,
  )
  tasks: list[asyncio.Task] = []
  if not settings.telegram_bot_token:
    logger.warning("telegram_bot_token_missing")
    try:
      yield
    finally:
      await redis.aclose()
    return

  application = await build_application()

  # Only consume alerts, no polling to avoid conflicts
  tasks = [
    asyncio.create_task(consume_alerts_forever(stop, redis, application), name="alert_consumer"),
    asyncio.create_task(_log_subscriber_stats_forever(stop), name="subscription_stats"),
  ]
  try:
    yield
  finally:
    stop.set()
    for t in tasks:
      t.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
    await redis.aclose()


app = FastAPI(title="telegram-bot", lifespan=lifespan)


@app.get("/health")
async def health():
  return {"status": "ok"}


@app.post("/alerts/test")
async def test_alert(message: str = Query("Test alert from SightWhale")):
  if not settings.telegram_bot_token or not settings.telegram_alert_chat_id:
    return {"ok": False, "error": "telegram_alert_config_missing"}
  url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
  payload = {
    "chat_id": settings.telegram_alert_chat_id,
    "text": message,
    "parse_mode": "HTML",
    "disable_web_page_preview": True,
  }
  async with httpx.AsyncClient() as client:
    resp = await client.post(url, json=payload, timeout=10)
  if resp.status_code < 200 or resp.status_code >= 300:
    return {"ok": False, "status": resp.status_code, "body": resp.text[:200]}
  return {"ok": True}


@app.get("/admin/diag/config")
async def admin_diag_config(x_admin_token: str | None = Header(None, alias="X-Admin-Token")):
  _require_admin(x_admin_token)

  redis = Redis.from_url(settings.redis_url, decode_responses=True)
  try:
    await redis.ping()
    q_len = await redis.llen(settings.alert_created_queue)
    last = await redis.lrange(settings.alert_created_queue, -1, -1)
    last_preview = (last[0] or "")[:200] if last else None
  finally:
    await redis.aclose()

  now = datetime.now(timezone.utc)
  db_ok = True
  subscriptions_total = 0
  subscriptions_active_now = 0
  deliveries_total = 0
  try:
    async with SessionLocal() as session:
      subscriptions_total = int((await session.execute(select(func.count()).select_from(Subscription))).scalar_one())
      subscriptions_active_now = int(
        (
          await session.execute(
            select(func.count())
            .select_from(Subscription)
            .where(Subscription.status.in_(["active", "trialing"]))
            .where(Subscription.current_period_end > now)
          )
        ).scalar_one()
      )
      deliveries_total = int((await session.execute(select(func.count()).select_from(Delivery))).scalar_one())
  except Exception:
    db_ok = False

  bot_token_present = bool(settings.telegram_bot_token)
  chat_id_present = bool(settings.telegram_alert_chat_id)
  return {
    "service": "telegram-bot",
    "redis": {
      "host": _redact_netloc(settings.redis_url),
      "alert_created_queue": settings.alert_created_queue,
      "alert_created_queue_len": int(q_len),
      "alert_created_queue_last_preview": last_preview,
    },
    "db": {
      "ok": db_ok,
      "subscriptions_total": subscriptions_total,
      "subscriptions_active_now": subscriptions_active_now,
      "deliveries_total": deliveries_total,
    },
    "telegram": {
      "bot_token_present": bot_token_present,
      "bot_token_hash": _hash_admin(settings.telegram_bot_token) if bot_token_present else None,
      "alert_chat_id_present": chat_id_present,
      "alert_chat_id_hash": _hash_admin(settings.telegram_alert_chat_id) if chat_id_present else None,
    },
    "fanout_rate_limit_per_minute": int(settings.alert_fanout_rate_limit_per_minute),
  }


@app.get("/admin/diag/subscribers")
async def admin_diag_subscribers(
  wallet: str,
  kind: str = Query("entry", pattern="^(entry|add|exit)$"),
  whale_score: float = Query(80, ge=0),
  trade_usd: float = Query(2000, ge=0),
  sample_limit: int = Query(50, ge=1, le=500),
  x_admin_token: str | None = Header(None, alias="X-Admin-Token"),
):
  _require_admin(x_admin_token)

  now = datetime.now(timezone.utc)
  w = (wallet or "").strip().lower()
  if not w:
    return {"ok": False, "error": "wallet_required"}

  async with SessionLocal() as session:
    has_users = await _has_users_table(session)
    has_follows = await _has_whale_follows_table(session)
    if has_users:
      user_join = or_(User.telegram_id == Subscription.telegram_id, User.id == Subscription.telegram_id)

    follow_ids: list[str] = []
    follow_count = 0
    if has_follows:
      if has_users:
        follow_base = (
          select(Subscription.telegram_id)
          .distinct()
          .join(User, user_join)
          .join(WhaleFollow, WhaleFollow.user_id == User.id)
          .where(Subscription.status.in_(["active", "trialing"]))
          .where(Subscription.current_period_end > now)
          .where(WhaleFollow.enabled.is_(True))
          .where(WhaleFollow.wallet == w)
          .where(WhaleFollow.min_size <= float(trade_usd))
          .where(WhaleFollow.min_score <= float(whale_score))
        )
      else:
        follow_base = (
          select(Subscription.telegram_id)
          .distinct()
          .join(WhaleFollow, WhaleFollow.user_id == Subscription.telegram_id)
          .where(Subscription.status.in_(["active", "trialing"]))
          .where(Subscription.current_period_end > now)
          .where(WhaleFollow.enabled.is_(True))
          .where(WhaleFollow.wallet == w)
          .where(WhaleFollow.min_size <= float(trade_usd))
          .where(WhaleFollow.min_score <= float(whale_score))
        )
      if kind == "exit":
        follow_base = follow_base.where(WhaleFollow.alert_exit.is_(True))
      elif kind == "add":
        follow_base = follow_base.where(WhaleFollow.alert_add.is_(True))
      else:
        follow_base = follow_base.where(WhaleFollow.alert_entry.is_(True))
      try:
        follow_ids = (await session.execute(follow_base.limit(int(sample_limit)))).scalars().all()
        follow_count = int(
          (await session.execute(select(func.count()).select_from(follow_base.subquery()))).scalar_one()
        )
      except Exception as e:
        if _is_missing_whale_follows_error(e):
          _mark_whale_follows_table_missing()
          follow_ids = []
          follow_count = 0
        else:
          raise

    if has_users:
      collection_base = (
        select(Subscription.telegram_id)
        .distinct()
        .join(User, user_join)
        .join(Collection, Collection.user_id == User.id)
        .join(CollectionWhale, CollectionWhale.collection_id == Collection.id)
        .where(Subscription.status.in_(["active", "trialing"]))
        .where(Subscription.current_period_end > now)
        .where(Collection.enabled.is_(True))
        .where(CollectionWhale.wallet == w)
      )
    else:
      collection_base = (
        select(Subscription.telegram_id)
        .distinct()
        .join(Collection, Collection.user_id == Subscription.telegram_id)
        .join(CollectionWhale, CollectionWhale.collection_id == Collection.id)
        .where(Subscription.status.in_(["active", "trialing"]))
        .where(Subscription.current_period_end > now)
        .where(Collection.enabled.is_(True))
        .where(CollectionWhale.wallet == w)
      )
    collection_ids = (await session.execute(collection_base.limit(int(sample_limit)))).scalars().all()
    collection_count = int(
      (await session.execute(select(func.count()).select_from(collection_base.subquery()))).scalar_one()
    )

    if has_users:
      smart_base = (
        select(Subscription.telegram_id)
        .distinct()
        .join(User, user_join)
        .join(SmartCollectionSubscription, SmartCollectionSubscription.user_id == User.id)
        .join(SmartCollection, SmartCollection.id == SmartCollectionSubscription.smart_collection_id)
        .join(SmartCollectionWhale, SmartCollectionWhale.smart_collection_id == SmartCollection.id)
        .where(Subscription.status.in_(["active", "trialing"]))
        .where(Subscription.current_period_end > now)
        .where(SmartCollection.enabled.is_(True))
        .where(SmartCollectionWhale.wallet == w)
      )
    else:
      smart_base = (
        select(Subscription.telegram_id)
        .distinct()
        .join(SmartCollectionSubscription, SmartCollectionSubscription.user_id == Subscription.telegram_id)
        .join(SmartCollection, SmartCollection.id == SmartCollectionSubscription.smart_collection_id)
        .join(SmartCollectionWhale, SmartCollectionWhale.smart_collection_id == SmartCollection.id)
        .where(Subscription.status.in_(["active", "trialing"]))
        .where(Subscription.current_period_end > now)
        .where(SmartCollection.enabled.is_(True))
        .where(SmartCollectionWhale.wallet == w)
      )
    smart_ids = (await session.execute(smart_base.limit(int(sample_limit)))).scalars().all()
    smart_count = int((await session.execute(select(func.count()).select_from(smart_base.subquery()))).scalar_one())

  recipients = list(dict.fromkeys([*follow_ids, *collection_ids, *smart_ids]))
  return {
    "ok": True,
    "wallet": w,
    "kind": kind,
    "whale_score": float(whale_score),
    "trade_usd": float(trade_usd),
    "counts": {
      "follow": follow_count,
      "collection": collection_count,
      "smart_collection": smart_count,
      "unique_total_sampled": len(recipients),
    },
    "sample": {
      "follow": [_hash_admin(str(t)) for t in follow_ids],
      "collection": [_hash_admin(str(t)) for t in collection_ids],
      "smart_collection": [_hash_admin(str(t)) for t in smart_ids],
      "unique": [_hash_admin(str(t)) for t in recipients],
    },
  }
