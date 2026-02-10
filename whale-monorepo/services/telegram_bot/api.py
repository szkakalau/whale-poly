import asyncio
import hashlib
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from uuid import uuid4

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
  Collection,
  CollectionWhale,
  Delivery,
  SmartCollection,
  SmartCollectionSubscription,
  SmartCollectionWhale,
  Subscription,
  User,
  WhaleFollow,
)


configure_logging(settings.log_level)
logger = logging.getLogger("telegram_bot.api")

_HAS_USERS_TABLE: bool | None = None
_HAS_WHALE_FOLLOWS_TABLE: bool | None = None
_HAS_COLLECTIONS_TABLES: bool | None = None
_HAS_SMART_COLLECTION_TABLES: bool | None = None


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


def _is_missing_collections_error(e: Exception) -> bool:
  msg = str(e).lower()
  return (
    ('relation "collections" does not exist' in msg)
    or ('relation "collection_whales" does not exist' in msg)
    or ("undefinedtableerror" in msg)
  )


def _mark_collections_tables_missing() -> None:
  global _HAS_COLLECTIONS_TABLES
  _HAS_COLLECTIONS_TABLES = False


async def _has_collections_tables(session) -> bool:
  global _HAS_COLLECTIONS_TABLES
  if _HAS_COLLECTIONS_TABLES is not None:
    return _HAS_COLLECTIONS_TABLES
  try:
    has_collections = bool((await session.execute(text("select to_regclass('public.collections')"))).scalar_one_or_none())
    has_whales = bool((await session.execute(text("select to_regclass('public.collection_whales')"))).scalar_one_or_none())
    _HAS_COLLECTIONS_TABLES = bool(has_collections and has_whales)
  except Exception:
    _HAS_COLLECTIONS_TABLES = False
  return _HAS_COLLECTIONS_TABLES


def _is_missing_smart_collections_error(e: Exception) -> bool:
  msg = str(e).lower()
  return (
    ('relation "smart_collections" does not exist' in msg)
    or ('relation "smart_collection_whales" does not exist' in msg)
    or ('relation "smart_collection_subscriptions" does not exist' in msg)
    or ("undefinedtableerror" in msg)
  )


def _mark_smart_collection_tables_missing() -> None:
  global _HAS_SMART_COLLECTION_TABLES
  _HAS_SMART_COLLECTION_TABLES = False


async def _has_smart_collection_tables(session) -> bool:
  global _HAS_SMART_COLLECTION_TABLES
  if _HAS_SMART_COLLECTION_TABLES is not None:
    return _HAS_SMART_COLLECTION_TABLES
  try:
    has_subs = bool((await session.execute(text("select to_regclass('public.smart_collection_subscriptions')"))).scalar_one_or_none())
    has_sc = bool((await session.execute(text("select to_regclass('public.smart_collections')"))).scalar_one_or_none())
    has_whales = bool((await session.execute(text("select to_regclass('public.smart_collection_whales')"))).scalar_one_or_none())
    _HAS_SMART_COLLECTION_TABLES = bool(has_subs and has_sc and has_whales)
  except Exception:
    _HAS_SMART_COLLECTION_TABLES = False
  return _HAS_SMART_COLLECTION_TABLES


async def _run_bot_runtime_forever(stop: asyncio.Event, redis: Redis, application) -> None:
  await application.initialize()
  await application.start()

  lock_key = "telegram_bot:polling_lock"
  lock_value: str | None = None
  polling = False

  try:
    while not stop.is_set():
      try:
        if polling:
          cur = await redis.get(lock_key)
          if cur != lock_value:
            try:
              await application.updater.stop()
            except Exception:
              pass
            polling = False
            lock_value = None
          else:
            await redis.expire(lock_key, 90)
        else:
          lock_value = uuid4().hex
          acquired = await redis.set(lock_key, lock_value, nx=True, ex=90)
          if acquired:
            try:
              await application.updater.start_polling(allowed_updates=["message", "callback_query"])
              polling = True
              logger.info("bot_polling_started")
            except Exception:
              logger.exception("bot_polling_start_failed")
              try:
                cur = await redis.get(lock_key)
                if cur == lock_value:
                  await redis.delete(lock_key)
              except Exception:
                pass
              polling = False
              lock_value = None
          else:
            lock_value = None
      except Exception:
        logger.exception("bot_runtime_loop_failed")

      try:
        await asyncio.wait_for(stop.wait(), timeout=30)
      except asyncio.TimeoutError:
        continue
  finally:
    if polling:
      try:
        await application.updater.stop()
      except Exception:
        pass
    await application.stop()
    await application.shutdown()


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


def _is_health_market(payload: dict) -> bool:
  title = str(payload.get("market_title") or payload.get("market_question") or "").lower()
  m_id = str(payload.get("market_id") or "").lower()
  return "health" in title or "health" in m_id


async def _send_via_bot(token: str, chat_id: str, text: str):
  url = f"https://api.telegram.org/bot{token}/sendMessage"
  payload = {
    "chat_id": chat_id,
    "text": text,
    "parse_mode": "HTML",
    "disable_web_page_preview": True,
  }
  async with httpx.AsyncClient() as client:
    try:
      resp = await client.post(url, json=payload, timeout=10)
      resp.raise_for_status()
    except Exception:
      logger.exception("send_via_bot_failed token_prefix=%s chat_id=%s", token[:10], chat_id)


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
    recipient_plan_map: dict[str, str] = {}
    lookup_db_ok = False
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
    try:
      async with SessionLocal() as session:
        has_users = await _has_users_table(session)
        has_follows = await _has_whale_follows_table(session)
        has_collections = await _has_collections_tables(session)
        has_smart = await _has_smart_collection_tables(session)

        if not has_follows and not has_collections and not has_smart:
          telegram_ids = (
            await session.execute(
              select(Subscription.telegram_id)
              .where(Subscription.status.in_(["active", "trialing"]))
              .where(Subscription.current_period_end > now)
            )
          ).scalars().all()
        else:
          async def _lookup_ids(has_users_flag: bool) -> tuple[list[str], list[str], list[str]]:
            follow_ids_v: list[str] = []
            if has_follows:
              if has_users_flag:
                user_join = or_(User.telegram_id == Subscription.telegram_id, User.id == Subscription.telegram_id)
                follow_query = (
                  select(Subscription.telegram_id)
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
                  select(Subscription.telegram_id)
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
                follow_ids_v = (await session.execute(follow_query)).scalars().all()
              except Exception as e:
                if _is_missing_whale_follows_error(e):
                  _mark_whale_follows_table_missing()
                  follow_ids_v = []
                else:
                  raise

            collection_ids_v: list[str] = []
            if has_collections:
              if has_users_flag:
                user_join = or_(User.telegram_id == Subscription.telegram_id, User.id == Subscription.telegram_id)
                collection_query = (
                  select(Subscription.telegram_id)
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
                  select(Subscription.telegram_id)
                  .join(Collection, Collection.user_id == Subscription.telegram_id)
                  .join(CollectionWhale, CollectionWhale.collection_id == Collection.id)
                  .where(Subscription.status.in_(["active", "trialing"]))
                  .where(Subscription.current_period_end > now)
                  .where(Collection.enabled.is_(True))
                  .where(CollectionWhale.wallet == wallet)
                )
              try:
                collection_ids_v = (await session.execute(collection_query)).scalars().all()
              except Exception as e:
                if _is_missing_collections_error(e):
                  _mark_collections_tables_missing()
                  collection_ids_v = []
                else:
                  raise

            smart_ids_v: list[str] = []
            if has_smart:
              if has_users_flag:
                user_join = or_(User.telegram_id == Subscription.telegram_id, User.id == Subscription.telegram_id)
                smart_query = (
                  select(Subscription.telegram_id)
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
                  select(Subscription.telegram_id)
                  .join(SmartCollectionSubscription, SmartCollectionSubscription.user_id == Subscription.telegram_id)
                  .join(SmartCollection, SmartCollection.id == SmartCollectionSubscription.smart_collection_id)
                  .join(SmartCollectionWhale, SmartCollectionWhale.smart_collection_id == SmartCollection.id)
                  .where(Subscription.status.in_(["active", "trialing"]))
                  .where(Subscription.current_period_end > now)
                  .where(SmartCollection.enabled.is_(True))
                  .where(SmartCollectionWhale.wallet == wallet)
                )
              try:
                smart_ids_v = (await session.execute(smart_query)).scalars().all()
              except Exception as e:
                if _is_missing_smart_collections_error(e):
                  _mark_smart_collection_tables_missing()
                  smart_ids_v = []
                else:
                  raise
            return follow_ids_v, collection_ids_v, smart_ids_v

          try:
            follow_ids, collection_ids, smart_ids = await _lookup_ids(has_users)
          except Exception as e:
            if has_users and _is_missing_users_error(e):
              _mark_users_table_missing()
              follow_ids, collection_ids, smart_ids = await _lookup_ids(False)
            else:
              raise

          # Global feed logic: if a subscriber has NO configurations, they get everything.
          # This maintains backward compatibility for users who haven't set up follows.
          async def _get_global_ids(has_users_flag: bool) -> set[str]:
            all_active_q = (
              select(Subscription.telegram_id)
              .where(Subscription.status.in_(["active", "trialing"]))
              .where(Subscription.current_period_end > now)
            )
            all_active = set((await session.execute(all_active_q)).scalars().all())
            if not all_active:
              return set()

            configured = set()
            if has_follows:
              if has_users_flag:
                user_join = or_(User.telegram_id == Subscription.telegram_id, User.id == Subscription.telegram_id)
                q = select(Subscription.telegram_id).join(User, user_join).join(WhaleFollow, WhaleFollow.user_id == User.id)
              else:
                q = select(Subscription.telegram_id).join(WhaleFollow, WhaleFollow.user_id == Subscription.telegram_id)
              configured.update((await session.execute(q)).scalars().all())

            if has_collections:
              if has_users_flag:
                user_join = or_(User.telegram_id == Subscription.telegram_id, User.id == Subscription.telegram_id)
                q = select(Subscription.telegram_id).join(User, user_join).join(Collection, Collection.user_id == User.id)
              else:
                q = select(Subscription.telegram_id).join(Collection, Collection.user_id == Subscription.telegram_id)
              configured.update((await session.execute(q)).scalars().all())

            if has_smart:
              if has_users_flag:
                user_join = or_(User.telegram_id == Subscription.telegram_id, User.id == Subscription.telegram_id)
                q = select(Subscription.telegram_id).join(User, user_join).join(SmartCollectionSubscription, SmartCollectionSubscription.user_id == User.id)
              else:
                q = select(Subscription.telegram_id).join(SmartCollectionSubscription, SmartCollectionSubscription.user_id == Subscription.telegram_id)
              configured.update((await session.execute(q)).scalars().all())

            return all_active - configured

          try:
            global_ids = await _get_global_ids(has_users)
          except Exception as e:
            if has_users and _is_missing_users_error(e):
              _mark_users_table_missing()
              global_ids = await _get_global_ids(False)
            else:
              global_ids = set()

          telegram_ids = list(dict.fromkeys([*follow_ids, *collection_ids, *smart_ids, *list(global_ids)]))
        lookup_db_ok = True
    except Exception:
      logger.exception("subscriber_lookup_failed")
      telegram_ids = []
      lookup_db_ok = False

    if settings.telegram_alert_chat_id:
      telegram_ids = list(dict.fromkeys([*telegram_ids, settings.telegram_alert_chat_id]))

    is_health = _is_health_market(payload)
    if is_health and settings.telegram_health_chat_id:
      telegram_ids = list(dict.fromkeys([*telegram_ids, settings.telegram_health_chat_id]))

    if not telegram_ids:
      logger.info("alert_no_recipients whale_trade_id=%s", whale_trade_id)
      continue

    try:
      async with SessionLocal() as session:
        rows = (
          await session.execute(
            select(Subscription.telegram_id, Subscription.plan)
            .where(Subscription.telegram_id.in_(telegram_ids))
            .where(Subscription.status.in_(["active", "trialing"]))
            .where(Subscription.current_period_end > now)
          )
        ).all()
      recipient_plan_map = {str(tid): (plan or "FREE") for tid, plan in rows}
    except Exception:
      recipient_plan_map = {}

    logger.info("alert_processing whale_trade_id=%s total_potential_recipients=%s", whale_trade_id, len(telegram_ids))

    signal_level = (payload.get("signal_level") or "").lower()
    behavior = payload.get("behavior")
    score_value = _safe_float(payload.get("whale_score") or payload.get("score")) or 0.0
    size_value = _safe_float(payload.get("size") or payload.get("amount")) or 0.0
    config = get_alert_config()
    thresholds = config.get("alert_thresholds", {})
    confidence = thresholds.get("confidence_scores", {})
    usd_thresholds = thresholds.get("usd_thresholds", {})
    high_score = float(confidence.get("high_confidence", 85))
    high_usd = float(usd_thresholds.get("high", 400))
    high_confidence = (score_value >= high_score and size_value >= high_usd) or bool(behavior)
    market_id = str(payload.get("market_id") or payload.get("raw_token_id") or "")
    wallet_value = str(payload.get("wallet_address") or "").lower()

    async def _send_one(tid: str, is_admin: bool):
      plan_name = recipient_plan_map.get(tid, "FREE").upper()
      limits = PLAN_LIMITS_MAP.get(plan_name, PLAN_LIMITS_MAP["FREE"])

      if not await check_daily_alert_limit(redis, tid, limits["max_alerts_per_day"]):
        return

      # Admin is exempt from rate limits
      if not is_admin:
        if not await allow_send(redis, tid, settings.alert_fanout_rate_limit_per_minute):
          return
      if plan_name == "PRO" and not high_confidence:
        return

      elite_priority_key = f"elite:last:{tid}"
      elite_same_focus = False
      if plan_name == "ELITE" and market_id and wallet_value:
        last_focus = await redis.get(elite_priority_key)
        elite_same_focus = last_focus == f"{wallet_value}|{market_id}"

      try:
        # Check delivery inside its own session to avoid holding a global session
        async with SessionLocal() as session:
          result = await session.execute(
            insert(Delivery)
            .values(telegram_id=tid, whale_trade_id=whale_trade_id)
            .on_conflict_do_nothing(index_elements=["telegram_id", "whale_trade_id"])
          )
          rowcount = result.rowcount
          await session.commit()

        if rowcount == 1:
          delay_seconds = limits["alert_delay_minutes"] * 60
          if plan_name == "ELITE" and signal_level == "low" and not elite_same_focus:
            delay_seconds = max(delay_seconds, 60)

          if delay_seconds > 0:
            async def _delayed_send():
              try:
                await asyncio.sleep(delay_seconds)
                if tid == settings.telegram_health_chat_id and is_health and settings.telegram_health_bot_token:
                  await _send_via_bot(settings.telegram_health_bot_token, tid, format_alert(payload, tid))
                else:
                  await application.bot.send_message(
                    chat_id=int(tid),
                    text=format_alert(payload, tid),
                    parse_mode="HTML",
                    disable_web_page_preview=True,
                  )
                await increment_daily_alert_count(redis, tid)
                if plan_name == "ELITE" and market_id and wallet_value:
                  await redis.set(elite_priority_key, f"{wallet_value}|{market_id}", ex=12 * 3600)
              except Exception:
                logger.exception("telegram_send_failed telegram_id=%s whale_trade_id=%s", tid, whale_trade_id)
            asyncio.create_task(_delayed_send())
            return

          # Route to specific bot if it's the health channel
          if tid == settings.telegram_health_chat_id and is_health and settings.telegram_health_bot_token:
            await _send_via_bot(settings.telegram_health_bot_token, tid, format_alert(payload, tid))
          else:
            await application.bot.send_message(
              chat_id=int(tid),
              text=format_alert(payload, tid),
              parse_mode="HTML",
              disable_web_page_preview=True,
            )
          await increment_daily_alert_count(redis, tid)
          if plan_name == "ELITE" and market_id and wallet_value:
            await redis.set(elite_priority_key, f"{wallet_value}|{market_id}", ex=12 * 3600)
      except Exception:
        logger.exception("telegram_send_failed telegram_id=%s whale_trade_id=%s", tid, whale_trade_id)

    tasks = []
    for tid in telegram_ids:
      is_admin = bool(settings.telegram_alert_chat_id and tid == settings.telegram_alert_chat_id)
      tasks.append(_send_one(tid, is_admin))

    if tasks:
      await asyncio.gather(*tasks)
      logger.info("alert_dispatched whale_trade_id=%s recipients_processed=%s", whale_trade_id, len(tasks))


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

  tasks = [
    asyncio.create_task(_run_bot_runtime_forever(stop, redis, application), name="bot_runtime"),
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
    has_collections = await _has_collections_tables(session)
    has_smart = await _has_smart_collection_tables(session)

    async def _run_queries(has_users_flag: bool):
      follow_ids_v: list[str] = []
      follow_count_v = 0
      if has_follows:
        if has_users_flag:
          user_join = or_(User.telegram_id == Subscription.telegram_id, User.id == Subscription.telegram_id)
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
          follow_ids_v = (await session.execute(follow_base.limit(int(sample_limit)))).scalars().all()
          follow_count_v = int(
            (await session.execute(select(func.count()).select_from(follow_base.subquery()))).scalar_one()
          )
        except Exception as e:
          if _is_missing_whale_follows_error(e):
            _mark_whale_follows_table_missing()
            follow_ids_v = []
            follow_count_v = 0
          else:
            raise

      collection_ids_v: list[str] = []
      collection_count_v = 0
      if has_collections:
        if has_users_flag:
          user_join = or_(User.telegram_id == Subscription.telegram_id, User.id == Subscription.telegram_id)
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
        try:
          collection_ids_v = (await session.execute(collection_base.limit(int(sample_limit)))).scalars().all()
          collection_count_v = int(
            (await session.execute(select(func.count()).select_from(collection_base.subquery()))).scalar_one()
          )
        except Exception as e:
          if _is_missing_collections_error(e):
            _mark_collections_tables_missing()
            collection_ids_v = []
            collection_count_v = 0
          else:
            raise

      smart_ids_v: list[str] = []
      smart_count_v = 0
      if has_smart:
        if has_users_flag:
          user_join = or_(User.telegram_id == Subscription.telegram_id, User.id == Subscription.telegram_id)
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
        try:
          smart_ids_v = (await session.execute(smart_base.limit(int(sample_limit)))).scalars().all()
          smart_count_v = int((await session.execute(select(func.count()).select_from(smart_base.subquery()))).scalar_one())
        except Exception as e:
          if _is_missing_smart_collections_error(e):
            _mark_smart_collection_tables_missing()
            smart_ids_v = []
            smart_count_v = 0
          else:
            raise

      return (
        follow_ids_v,
        follow_count_v,
        collection_ids_v,
        collection_count_v,
        smart_ids_v,
        smart_count_v,
      )

    try:
      (
        follow_ids,
        follow_count,
        collection_ids,
        collection_count,
        smart_ids,
        smart_count,
      ) = await _run_queries(has_users)
    except Exception as e:
      if has_users and _is_missing_users_error(e):
        _mark_users_table_missing()
        (
          follow_ids,
          follow_count,
          collection_ids,
          collection_count,
          smart_ids,
          smart_count,
        ) = await _run_queries(False)
      else:
        raise

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
