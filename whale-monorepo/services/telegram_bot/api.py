import asyncio
import hashlib
import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from uuid import uuid4

import httpx
from fastapi import FastAPI, Header, HTTPException, Query
from redis.asyncio import Redis
from sqlalchemy import func, or_, select, text
from sqlalchemy.dialects.postgresql import insert
from urllib.parse import urlparse

from services.telegram_bot.bot import _COMMANDS, build_application
from services.telegram_bot.delivery_cooldown import (
  CooldownAction,
  compute_effective_score,
  handle_cooldown_before_send,
  record_after_digest_flush,
  record_push_for_group,
)
from services.telegram_bot.elite_filters import elite_delivery_allowed
from services.telegram_bot.templates import format_alert, format_digest_lines
from services.telegram_bot.rate_limit import allow_send, check_daily_alert_limit, try_increment_daily_alert_count
from services.telegram_bot.recipients import (
  AlertRecipient,
  dedupe_recipients,
  dedupe_triples,
  group_recipients_by_telegram,
)
from shared.config import settings, get_alert_config, parse_duration
from shared.db import SessionLocal
from shared.logging import configure_logging, redact_secrets
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
_REDIS_OK: bool | None = None


async def _resolve_outcome_from_token(redis: Redis, token_id: str) -> str | None:
  tid = str(token_id or "").strip()
  if not tid:
    return None
  cache_key = f"token_outcome:{tid}"
  cached = await redis.get(cache_key)
  if cached:
    return None if cached == "__none__" else cached
  proxy = settings.https_proxy or None
  outcome: str | None = None
  try:
    async with httpx.AsyncClient(proxy=proxy) as client:
      resp = await client.get("https://clob.polymarket.com/book", params={"token_id": tid}, timeout=10)
      if resp.status_code == 200:
        book = resp.json()
        condition_id = None
        if isinstance(book, dict):
          condition_id = book.get("market") or book.get("condition_id")
        if condition_id:
          for url in (
            f"https://clob.polymarket.com/markets/{condition_id}",
            f"https://clob.polymarket.com/market/{condition_id}",
          ):
            try:
              market_resp = await client.get(url, timeout=10)
            except Exception:
              continue
            if market_resp.status_code != 200:
              continue
            market = market_resp.json()
            if not isinstance(market, dict):
              continue
            tokens = market.get("tokens")
            if not isinstance(tokens, list):
              continue
            tid_lower = tid.lower()
            for t in tokens:
              if not isinstance(t, dict):
                continue
              token_value = str(t.get("token_id") or t.get("asset_id") or t.get("tokenId") or t.get("id") or "").strip().lower()
              if token_value == tid_lower:
                outcome = str(t.get("outcome") or "").strip() or None
                if outcome:
                  break
            if outcome:
              break
  except Exception:
    outcome = None
  if outcome is not None and str(outcome).strip():
    await redis.set(cache_key, str(outcome), ex=86400)
    return str(outcome)
  await redis.set(cache_key, "__none__", ex=120)
  return None


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
  await application.bot.set_my_commands(_COMMANDS)

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
            except Exception as exc:
              # start_polling hits api.telegram.org — redact the URL/token.
              logger.error("bot_polling_start_failed err=%s", redact_secrets(f"{type(exc).__name__}: {exc}"))
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
      except Exception as exc:
        logger.error("bot_runtime_loop_failed err=%s", redact_secrets(f"{type(exc).__name__}: {exc}"))

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


from shared.auth import require_admin as _require_admin


def _hash_admin(value: str) -> str:
  return hashlib.sha1(f"admin:{value}".encode("utf-8")).hexdigest()[:10]


def _is_health_market(payload: dict) -> bool:
  title = str(payload.get("market_title") or payload.get("market_question") or "").lower()
  m_id = str(payload.get("market_id") or "").lower()
  return "health" in title or "health" in m_id


_NO_SESSION_MARKERS = (
  "can't initiate conversation",
  "cannot initiate conversation",
  "bot was blocked by the user",
  "user is deactivated",
  "chat not found",
)


def _is_no_session_error(exc: BaseException) -> bool:
  """
  Telegram hard limit: a bot cannot message a user who never opened a chat
  with it (or who blocked / deleted it). Detect it so we can alert on it.
  """
  text = str(exc).lower()
  return any(marker in text for marker in _NO_SESSION_MARKERS)


def _log_send_failure(tid: str, whale_trade_id: str, exc: BaseException) -> None:
  if _is_no_session_error(exc):
    # Distinct, greppable marker — this user will NEVER receive an alert
    # until they press START on a deep link.
    logger.error(
      "DELIVERY_BLOCKED_NO_SESSION telegram_id=%s whale_trade_id=%s reason=%s",
      tid,
      whale_trade_id,
      redact_secrets(str(exc))[:160],
    )
    return
  # Deliberately NOT logger.exception(): the exception text can embed the
  # Telegram bot URL (token included). Redact before it reaches the sink.
  logger.error(
    "telegram_send_failed telegram_id=%s whale_trade_id=%s err=%s",
    tid,
    whale_trade_id,
    redact_secrets(f"{type(exc).__name__}: {exc}"),
  )


# ── Delivery outcome ledger (F1) ─────────────────────────────────────────
# The `deliveries` row is both the idempotency claim and the outcome record:
#   * claim  — insert (or re-claim a previously 'failed' row) as 'pending';
#   * finish — update the claimed row to 'sent' (success) or 'failed' (failure).
# A pair is "already handled" iff its row is 'pending' or 'sent'. A 'failed'
# row stays re-claimable, so a transient send failure retries on the next
# round instead of being permanently blocked by its own claim row.
_STATUS_PENDING = "pending"
_STATUS_SENT = "sent"
_STATUS_FAILED = "failed"


def _delivery_error_text(exc: BaseException) -> str:
  """Short, credential-redacted failure reason, capped to the 200-char column."""
  return redact_secrets(f"{type(exc).__name__}: {exc}")[:200]


# The unique index the two upserts below conflict on. Kept in one place so the
# claim and the finish can never disagree about the identity of a delivery.
_DELIVERY_CONFLICT_COLUMNS = ["telegram_id", "whale_trade_id"]


def _delivery_claim_stmt(telegram_id: str, whale_trade_id: str):
  """Build the claim upsert: take the delivery slot for this pair as 'pending'.

  The `where` is the whole point of the state machine — it decides who is
  allowed to win the conflict:

    * a 'failed' row passes, so a transient send failure is retried later;
    * a 'pending' row fails it (another task is already sending);
    * a 'sent' row fails it, so a delivered alert is NEVER sent twice.

  A single atomic statement makes the claim concurrency-safe: a racing claim
  blocks on `uq_deliveries`, then re-evaluates this WHERE against the committed
  row, so exactly one claimant ever gets a returned id.
  """
  return (
    insert(Delivery)
    .values(
      telegram_id=telegram_id,
      whale_trade_id=whale_trade_id,
      status=_STATUS_PENDING,
      updated_at=func.now(),
    )
    .on_conflict_do_update(
      index_elements=_DELIVERY_CONFLICT_COLUMNS,
      set_={"status": _STATUS_PENDING, "error": None, "updated_at": func.now()},
      where=(Delivery.status == _STATUS_FAILED),
    )
    .returning(Delivery.id)
  )


def _delivery_finish_stmt(
  telegram_id: str,
  whale_trade_id: str,
  status: str,
  error: str | None = None,
):
  """Build the outcome upsert (the single writer of a terminal delivery state).

  Upsert rather than UPDATE because the digest-flush path delivers an alert
  *before* any claim row exists. The conflict guards keep the machine
  monotonic in both directions:

    * marking 'sent' carries ``status != 'sent'`` — re-marking a success is a
      no-op, never a second write;
    * marking 'failed' carries ``status == 'pending'`` — it can only move a row
      this task claimed, so a failure can never downgrade a successful send,
      nor clear a claim that belongs to another task.
  """
  if status == _STATUS_SENT:
    conflict_where = Delivery.status != _STATUS_SENT
  else:
    conflict_where = Delivery.status == _STATUS_PENDING
  return (
    insert(Delivery)
    .values(
      telegram_id=telegram_id,
      whale_trade_id=whale_trade_id,
      status=status,
      error=error,
      updated_at=func.now(),
    )
    .on_conflict_do_update(
      index_elements=_DELIVERY_CONFLICT_COLUMNS,
      set_={"status": status, "error": error, "updated_at": func.now()},
      where=conflict_where,
    )
  )


async def _finish_delivery(
  telegram_id: str,
  whale_trade_id: str,
  status: str,
  error: str | None = None,
) -> None:
  """Write the terminal delivery outcome for a (telegram_id, whale_trade_id) pair.

  Upserting covers the digest-flush path too, which delivers the alert as part
  of a combined digest *before* any claim row exists. The conflict guards keep
  the state machine monotonic:
    * marking 'sent' never overwrites an existing 'sent';
    * marking 'failed' only moves a row this task claimed ('pending'), so it
      can never downgrade a successful send or clear a foreign claim.

  The statement itself lives in ``_delivery_finish_stmt`` so its guards can be
  asserted directly in tests (a compiled-SQL check, no database required).
  """
  try:
    async with SessionLocal() as session:
      await session.execute(
        _delivery_finish_stmt(telegram_id, whale_trade_id, status, error)
      )
      await session.commit()
  except Exception as exc:
    # Bookkeeping must never break the delivery path. Redact — an httpx error
    # can carry the full Telegram bot URL.
    logger.error(
      "delivery_result_write_failed telegram_id=%s whale_trade_id=%s status=%s err=%s",
      telegram_id,
      whale_trade_id,
      status,
      redact_secrets(f"{type(exc).__name__}: {exc}"),
    )


async def _send_via_bot(token: str, chat_id: str, text: str) -> bool:
  """Send one message using an explicit health-bot token.

  Returns True on a 2xx response, False on any failure.

  Failures are logged here (redacted) and deliberately NOT re-raised: the raw
  httpx exception embeds the request URL — `.../bot<TOKEN>/sendMessage` — so it
  is contained inside this function, the single redaction sink, instead of
  propagating to callers. Callers must treat a False return as a send failure
  (D2: previously the swallowed failure let them record a fake 'sent').
  """
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
      return True
    except httpx.HTTPStatusError as exc:
      # httpx embeds the full request URL — bot token included — in the
      # HTTPStatusError message. logger.exception() would render it verbatim,
      # so log a redacted message instead (no traceback) and drop the token.
      logger.error(
        "send_via_bot_failed chat_id=%s status=%s err=%s",
        chat_id,
        getattr(exc.response, "status_code", None),
        redact_secrets(str(exc)),
      )
      return False
    except Exception as exc:
      # Same hazard: some transport errors carry the request URL too.
      logger.error(
        "send_via_bot_failed chat_id=%s err=%s",
        chat_id,
        redact_secrets(f"{type(exc).__name__}: {exc}"),
      )
      return False


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
  async def _process_raw(raw: str) -> None:
    try:
      payload = json.loads(raw)
    except Exception:
      return

    whale_trade_id = str(payload.get("whale_trade_id") or "")
    if not whale_trade_id:
      return
    if not (payload.get("outcome") and str(payload.get("outcome")).strip()):
      token_id = str(payload.get("raw_token_id") or payload.get("market_id") or "").strip()
      if token_id:
        resolved = await _resolve_outcome_from_token(redis, token_id)
        if resolved:
          payload["outcome"] = resolved

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

    triples: list[tuple[str, str, str]] = []
    lookup_db_ok = False
    config = get_alert_config()
    plan_cfg = config.get("user_plans", {})

    def _plan_limits(name: str, default_delay_minutes: int, default_max_alerts, default_min_score: int):
      data = plan_cfg.get(name, {})
      delay_seconds = parse_duration(data.get("alerts_delay"), default_delay_minutes * 60)
      delay_minutes = int(delay_seconds / 60)
      max_alerts = data.get("max_alerts_per_day", default_max_alerts)
      min_score = data.get("min_whale_score", default_min_score)
      return {"max_alerts_per_day": max_alerts, "alert_delay_minutes": delay_minutes, "min_whale_score": int(min_score)}

    PLAN_LIMITS_MAP = {
      # Fallback defaults only (alert_engine_config.yaml wins). Kept in sync
      # with the widened free tier: 10 alerts/day, 5m delay.
      "FREE": _plan_limits("free", 5, 10, 0),
      "PRO": _plan_limits("pro", 0, "unlimited", 70),
      "ELITE": _plan_limits("elite", 0, "unlimited", 80),
    }
    try:
      async with SessionLocal() as session:
        has_users = await _has_users_table(session)
        has_follows = await _has_whale_follows_table(session)
        has_collections = await _has_collections_tables(session)
        has_smart = await _has_smart_collection_tables(session)

        if not has_follows and not has_collections and not has_smart:
          broadcast_tids = (
            await session.execute(
              select(Subscription.telegram_id)
              .where(Subscription.status.in_(["active", "trialing"]))
              .where(Subscription.current_period_end > now)
            )
          ).scalars().all()
          triples = [(str(tid), "broadcast", "*") for tid in broadcast_tids]
        else:
          async def _lookup_triples(has_users_flag: bool) -> list[tuple[str, str, str]]:
            out: list[tuple[str, str, str]] = []
            if has_follows:
              follow_ids_v: list[str] = []
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
              for tid in follow_ids_v:
                out.append((str(tid), "whale", wallet))

            if has_collections:
              if has_users_flag:
                user_join = or_(User.telegram_id == Subscription.telegram_id, User.id == Subscription.telegram_id)
                collection_query = (
                  select(Subscription.telegram_id, Collection.id)
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
                  select(Subscription.telegram_id, Collection.id)
                  .join(Collection, Collection.user_id == Subscription.telegram_id)
                  .join(CollectionWhale, CollectionWhale.collection_id == Collection.id)
                  .where(Subscription.status.in_(["active", "trialing"]))
                  .where(Subscription.current_period_end > now)
                  .where(Collection.enabled.is_(True))
                  .where(CollectionWhale.wallet == wallet)
                )
              try:
                for row in (await session.execute(collection_query)).all():
                  out.append((str(row[0]), "collection", str(row[1])))
              except Exception as e:
                if _is_missing_collections_error(e):
                  _mark_collections_tables_missing()
                else:
                  raise

            if has_smart:
              if has_users_flag:
                user_join = or_(User.telegram_id == Subscription.telegram_id, User.id == Subscription.telegram_id)
                smart_query = (
                  select(Subscription.telegram_id, SmartCollection.id)
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
                  select(Subscription.telegram_id, SmartCollection.id)
                  .join(SmartCollectionSubscription, SmartCollectionSubscription.user_id == Subscription.telegram_id)
                  .join(SmartCollection, SmartCollection.id == SmartCollectionSubscription.smart_collection_id)
                  .join(SmartCollectionWhale, SmartCollectionWhale.smart_collection_id == SmartCollection.id)
                  .where(Subscription.status.in_(["active", "trialing"]))
                  .where(Subscription.current_period_end > now)
                  .where(SmartCollection.enabled.is_(True))
                  .where(SmartCollectionWhale.wallet == wallet)
                )
              try:
                for row in (await session.execute(smart_query)).all():
                  out.append((str(row[0]), "smart_collection", str(row[1])))
              except Exception as e:
                if _is_missing_smart_collections_error(e):
                  _mark_smart_collection_tables_missing()
                else:
                  raise
            return out

          try:
            size_bucket = int(max(0.0, size_v) // 500)
            score_bucket = int(max(0.0, score_v) // 5)
            cache_key = f"subs2:{wallet}:{size_bucket}:{score_bucket}:{int(has_users)}"
            channel_triples: list[tuple[str, str, str]] = []
            cached_raw = await redis.get(cache_key)
            if cached_raw:
              try:
                data = json.loads(cached_raw)
                if data.get("v") == 2:
                  raw_items = data.get("items", []) or []
                  channel_triples = [(str(x[0]), str(x[1]), str(x[2])) for x in raw_items]
                else:
                  channel_triples = []
                  for tid in data.get("follow", []) or []:
                    channel_triples.append((str(tid), "whale", wallet))
                  for tid in data.get("collections", []) or []:
                    channel_triples.append((str(tid), "collection", "_"))
                  for tid in data.get("smart", []) or []:
                    channel_triples.append((str(tid), "smart_collection", "_"))
              except Exception:
                channel_triples = await _lookup_triples(has_users)
            else:
              channel_triples = await _lookup_triples(has_users)
              try:
                await redis.set(
                  cache_key,
                  json.dumps({"v": 2, "items": [list(t) for t in channel_triples]}),
                  ex=120,
                )
              except Exception:
                pass
          except Exception as e:
            if has_users and _is_missing_users_error(e):
              _mark_users_table_missing()
              channel_triples = await _lookup_triples(False)
            else:
              raise

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
            g_key = f"subs_global:{int(has_users)}"
            g_cached = await redis.get(g_key)
            if g_cached:
              try:
                global_ids = set(json.loads(g_cached) or [])
              except Exception:
                global_ids = set()
            else:
              global_ids = await _get_global_ids(has_users)
              try:
                await redis.set(g_key, json.dumps(list(global_ids)), ex=120)
              except Exception:
                pass
          except Exception as e:
            if has_users and _is_missing_users_error(e):
              _mark_users_table_missing()
              global_ids = await _get_global_ids(False)
            else:
              global_ids = set()

          merged: list[tuple[str, str, str]] = [*channel_triples]
          for gid in global_ids:
            merged.append((str(gid), "global", "*"))
          triples = dedupe_triples(merged)
        lookup_db_ok = True
    except Exception:
      logger.exception("subscriber_lookup_failed")
      triples = []
      lookup_db_ok = False

    if settings.telegram_alert_chat_id:
      aid = str(settings.telegram_alert_chat_id)
      triples.append((aid, "admin", aid))

    is_health = _is_health_market(payload)
    if is_health and settings.telegram_health_chat_id:
      hid = str(settings.telegram_health_chat_id)
      triples.append((hid, "health", "*"))

    triples = dedupe_triples(triples)
    telegram_ids = list(dict.fromkeys([t[0] for t in triples]))

    if not telegram_ids:
      logger.info("alert_no_recipients whale_trade_id=%s", whale_trade_id)
      return

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

    recipients = [
      AlertRecipient(
        telegram_id=t,
        source_type=st,
        source_id=sid,
        plan=str(recipient_plan_map.get(t, "FREE")).upper(),
      )
      for t, st, sid in triples
    ]
    recipients = dedupe_recipients(recipients)
    grouped_recipients = group_recipients_by_telegram(recipients)

    logger.info("alert_processing whale_trade_id=%s total_potential_recipients=%s", whale_trade_id, len(telegram_ids))

    signal_level = (payload.get("signal_level") or "").lower()
    behavior = payload.get("behavior")
    score_value = _safe_float(payload.get("whale_score") or payload.get("score")) or 0.0
    size_value = _safe_float(payload.get("size") or payload.get("amount")) or 0.0
    market_id = str(payload.get("market_id") or payload.get("raw_token_id") or "")
    wallet_value = str(payload.get("wallet_address") or "").lower()

    async def _send_one(tid: str, plan_name: str, is_admin: bool, matched_group: list[AlertRecipient]):
      plan_name = plan_name.upper()
      limits = PLAN_LIMITS_MAP.get(plan_name, PLAN_LIMITS_MAP["FREE"])

      # Atomically increment the daily counter FIRST — this is the real
      # gatekeeper (CR-C4).  The old pattern checked a pure-read limit at the
      # top and incremented after delivery; two concurrent requests could both
      # pass the read check, deliver two alerts, and then the late increment
      # would roll back — the alert was sent but not counted.
      if not await try_increment_daily_alert_count(redis, tid, limits["max_alerts_per_day"]):
        return

      # Admin is exempt from rate limits
      if not is_admin:
        if not await allow_send(redis, tid, settings.alert_fanout_rate_limit_per_minute):
          # Roll back the daily count — we're not sending after all.
          today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
          await redis.decr(f"alert_limit:{tid}:{today}")
          return
      # Plan-based score filter: Pro ≥70, Elite ≥80 (see alert_engine_config.yaml)
      min_score = limits.get("min_whale_score", 0)
      if score_value < min_score:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        await redis.decr(f"alert_limit:{tid}:{today}")
        return

      if plan_name == "ELITE" and settings.elite_delivery_filters_enabled:
        try:
          async with SessionLocal() as session:
            if not await elite_delivery_allowed(session, tid, wallet_value, payload, plan_name, matched_group):
              today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
              await redis.decr(f"alert_limit:{tid}:{today}")
              return
        except Exception:
          logger.exception("elite_filter_failed telegram_id=%s", tid)

      cd = await handle_cooldown_before_send(
        redis,
        tid,
        plan_name,
        payload,
        raw,
        matched_group,
        format_digest_lines,
      )
      if cd.action == CooldownAction.QUEUED:
        # Cooldown queued the message for later delivery — keep the count.
        return
      if cd.action == CooldownAction.FLUSH_ONLY and cd.flush_combined_text:
        sent_ok = False
        try:
          if tid == settings.telegram_health_chat_id and is_health and settings.telegram_health_bot_token:
            ok = await _send_via_bot(settings.telegram_health_bot_token, tid, cd.flush_combined_text)
            if not ok:
              # Fixed string on purpose — never interpolate the raw exception,
              # which can embed .../bot<TOKEN>/sendMessage (D2).
              raise RuntimeError("health_send_failed")
          else:
            await application.bot.send_message(
              chat_id=int(tid),
              text=cd.flush_combined_text,
              parse_mode="HTML",
              disable_web_page_preview=True,
            )
          # The send call returned normally — from here on the ledger must end
          # up 'sent' no matter what the following bookkeeping does (D1).
          sent_ok = True
          # Ledger first, bookkeeping second: the ledger is the source of truth
          # for retry/idempotency, cooldown state is disposable. The current
          # alert's raw was pushed to the digest buffer just before this flush,
          # so it went out inside the digest — record it as sent (F1).
          await _finish_delivery(tid, whale_trade_id, _STATUS_SENT)
          # Count was already incremented at the top — no need to call
          # try_increment_daily_alert_count again.
          await record_after_digest_flush(redis, tid, matched_group, cd.flushed_raws or [])
        except Exception as exc:
          if sent_ok:
            # Message already delivered — a post-send bookkeeping failure must
            # never downgrade the ledger to a retryable state (D1: that would
            # re-claim and double-send).
            logger.error(
              "telegram_post_send_bookkeeping_failed telegram_id=%s whale_trade_id=%s err=%s",
              tid,
              whale_trade_id,
              redact_secrets(f"{type(exc).__name__}: {exc}"),
            )
          else:
            # Wraps application.bot.send_message — redact, the exception text
            # can carry the bot URL.
            logger.error(
              "telegram_digest_flush_failed telegram_id=%s whale_trade_id=%s err=%s",
              tid,
              whale_trade_id,
              redact_secrets(f"{type(exc).__name__}: {exc}"),
            )
            if _is_no_session_error(exc):
              # Also emit the greppable DELIVERY_BLOCKED_NO_SESSION marker so
              # "this subscriber can never be reached" is searchable no matter
              # which send path failed.
              _log_send_failure(tid, whale_trade_id, exc)
            await _finish_delivery(tid, whale_trade_id, _STATUS_FAILED, _delivery_error_text(exc))
        return

      backlog_raws = cd.backlog_raws or []

      def _message_body() -> str:
        base = format_alert(payload, tid)
        if backlog_raws:
          return f"{format_digest_lines(backlog_raws, tid)}\n\n{base}"
        return base

      elite_priority_key = f"elite:last:{tid}"
      elite_same_focus = False
      if plan_name == "ELITE" and market_id and wallet_value:
        last_focus = await redis.get(elite_priority_key)
        elite_same_focus = last_focus == f"{wallet_value}|{market_id}"

      # Claim the delivery slot for this (telegram_id, whale_trade_id) pair.
      # The row is upserted as 'pending'; only a previously *failed* row can be
      # re-claimed (F1). This makes the three properties hold simultaneously:
      #   * P2 failed → retryable: a 'failed' row passes the WHERE and is
      #     re-claimed on the next round.
      #   * P3 sent is never repeated: once 'sent', the WHERE is false, so the
      #     pair can never be claimed (and thus never re-sent) again.
      #   * P4 concurrency-safe: the upsert is a single atomic statement. A
      #     racing claim of the same pair blocks on the unique index, then
      #     re-evaluates the WHERE against the committed row — 'pending'/'sent'
      #     both fail it, so exactly one claimant ever wins.
      try:
        async with SessionLocal() as session:
          result = await session.execute(
            _delivery_claim_stmt(tid, whale_trade_id)
          )
          claimed = result.scalar_one_or_none() is not None
          await session.commit()
      except Exception as exc:
        logger.error(
          "delivery_claim_failed telegram_id=%s whale_trade_id=%s err=%s",
          tid,
          whale_trade_id,
          redact_secrets(f"{type(exc).__name__}: {exc}"),
        )
        return

      if not claimed:
        # Already 'pending' or 'sent' for this pair — do not deliver twice.
        #
        # This branch used to be silent, which made the ledger unfalsifiable:
        # losing the claim to a 'sent' row is the normal, healthy outcome
        # (reconcile replaying an already-delivered alert), while losing it to
        # a *stranded* 'pending' row means the alert is being dropped and will
        # not be retried. Both looked identical — nothing logged either way.
        # Read the current status back so the two are distinguishable.
        existing: str | None
        try:
          async with SessionLocal() as session:
            existing = await session.scalar(
              select(Delivery.status).where(
                Delivery.telegram_id == tid,
                Delivery.whale_trade_id == whale_trade_id,
              )
            )
        except Exception as exc:  # noqa: BLE001 — logging must never break delivery
          existing = None
          logger.warning(
            "delivery_claim_lost_status_unknown telegram_id=%s whale_trade_id=%s err=%s",
            tid,
            whale_trade_id,
            redact_secrets(f"{type(exc).__name__}: {exc}"),
          )
        if existing == _STATUS_PENDING:
          # The dangerous case: nothing in this process is sending this pair
          # (we just tried and lost), so the holder is either a concurrent
          # process or a claim stranded by a crash. A stranded row is only
          # released by reconcile at the next startup.
          logger.warning(
            "delivery_claim_lost_pending telegram_id=%s whale_trade_id=%s "
            "(pair held elsewhere; if no send is in flight this alert is "
            "stranded until reconcile releases it)",
            tid,
            whale_trade_id,
          )
        else:
          logger.info(
            "delivery_claim_lost status=%s telegram_id=%s whale_trade_id=%s",
            existing,
            tid,
            whale_trade_id,
          )
        return

      delay_seconds = limits["alert_delay_minutes"] * 60
      if plan_name == "ELITE" and signal_level == "low" and not elite_same_focus:
        delay_seconds = max(delay_seconds, 60)

      if delay_seconds > 0:
        async def _delayed_send():
          sent_ok = False
          try:
            await asyncio.sleep(delay_seconds)
            body = _message_body()
            # Add send timeout to prevent hanging tasks (CR-I2).
            if tid == settings.telegram_health_chat_id and is_health and settings.telegram_health_bot_token:
              ok = await asyncio.wait_for(
                _send_via_bot(settings.telegram_health_bot_token, tid, body),
                timeout=30,
              )
              if not ok:
                # Fixed string on purpose — never interpolate the raw
                # exception, which can embed .../bot<TOKEN>/sendMessage (D2).
                raise RuntimeError("health_send_failed")
            else:
              await asyncio.wait_for(
                application.bot.send_message(
                  chat_id=int(tid),
                  text=body,
                  parse_mode="HTML",
                  disable_web_page_preview=True,
                ),
                timeout=30,
              )
            # The send call returned normally — from here on the ledger must end
            # up 'sent' no matter what the following bookkeeping does (D1).
            sent_ok = True
            # Ledger first, bookkeeping second: the ledger drives retry, the
            # cooldown/priority state is disposable.
            await _finish_delivery(tid, whale_trade_id, _STATUS_SENT)
            # Daily count already incremented at the top of _send_one.
            await record_push_for_group(redis, tid, matched_group, compute_effective_score(payload))
            if plan_name == "ELITE" and market_id and wallet_value:
              await redis.set(elite_priority_key, f"{wallet_value}|{market_id}", ex=12 * 3600)
          except asyncio.TimeoutError:
            logger.error("telegram_send_timeout telegram_id=%s whale_trade_id=%s", tid, whale_trade_id)
            if not sent_ok:
              await _finish_delivery(
                tid, whale_trade_id, _STATUS_FAILED, "TimeoutError: send timed out after 30s"
              )
          except Exception as exc:
            if sent_ok:
              # Message already delivered — a post-send bookkeeping failure must
              # never downgrade the ledger to a retryable state (D1).
              logger.error(
                "telegram_post_send_bookkeeping_failed telegram_id=%s whale_trade_id=%s err=%s",
                tid,
                whale_trade_id,
                redact_secrets(f"{type(exc).__name__}: {exc}"),
              )
            else:
              _log_send_failure(tid, whale_trade_id, exc)
              await _finish_delivery(tid, whale_trade_id, _STATUS_FAILED, _delivery_error_text(exc))

        task = asyncio.create_task(_delayed_send())
        _pending_sends.add(task)
        task.add_done_callback(_pending_sends.discard)
        return

      body = _message_body()
      sent_ok = False
      try:
        if tid == settings.telegram_health_chat_id and is_health and settings.telegram_health_bot_token:
          ok = await _send_via_bot(settings.telegram_health_bot_token, tid, body)
          if not ok:
            # Fixed string on purpose — never interpolate the raw exception,
            # which can embed .../bot<TOKEN>/sendMessage (D2).
            raise RuntimeError("health_send_failed")
        else:
          await application.bot.send_message(
            chat_id=int(tid),
            text=body,
            parse_mode="HTML",
            disable_web_page_preview=True,
          )
        # The send call returned normally — from here on the ledger must end up
        # 'sent' no matter what the following bookkeeping does (D1).
        sent_ok = True
        # Ledger first, bookkeeping second (see _delayed_send above).
        await _finish_delivery(tid, whale_trade_id, _STATUS_SENT)
        # Daily count already incremented at the top of _send_one.
        await record_push_for_group(redis, tid, matched_group, compute_effective_score(payload))
        if plan_name == "ELITE" and market_id and wallet_value:
          await redis.set(elite_priority_key, f"{wallet_value}|{market_id}", ex=12 * 3600)
      except Exception as exc:
        if sent_ok:
          # Message already delivered — a post-send bookkeeping failure must
          # never downgrade the ledger to a retryable state (D1).
          logger.error(
            "telegram_post_send_bookkeeping_failed telegram_id=%s whale_trade_id=%s err=%s",
            tid,
            whale_trade_id,
            redact_secrets(f"{type(exc).__name__}: {exc}"),
          )
        else:
          # _log_send_failure emits the same redacted "telegram_send_failed" line
          # for generic errors, plus the greppable DELIVERY_BLOCKED_NO_SESSION
          # marker when the subscriber never opened a chat with the bot. Routing
          # the immediately-sent path through it too means the marker fires on
          # every send path (PRO/ELITE have a 0-minute delay, so this is the
          # common path).
          _log_send_failure(tid, whale_trade_id, exc)
          await _finish_delivery(tid, whale_trade_id, _STATUS_FAILED, _delivery_error_text(exc))

    tasks = []
    for tid, plan, group in grouped_recipients:
      logger.debug(
        "alert_recipients tid=%s whale_trade_id=%s sources=%s",
        tid,
        whale_trade_id,
        [(r.source_type, r.source_id) for r in group],
      )
      is_admin = bool(settings.telegram_alert_chat_id and tid == settings.telegram_alert_chat_id)
      tasks.append(_send_one(tid, plan, is_admin, group))

    if tasks:
      await asyncio.gather(*tasks)
      logger.info("alert_dispatched whale_trade_id=%s recipients_processed=%s", whale_trade_id, len(tasks))
    return

  while not stop.is_set():
    try:
      item = await redis.blpop(settings.alert_created_queue, timeout=1)
      if not item:
        continue
      _, raw = item
      raws = [raw]
      for _ in range(max(0, settings.alert_consume_batch_size - 1)):
        nxt = await redis.lpop(settings.alert_created_queue)
        if not nxt:
          break
        raws.append(nxt)
      for raw_item in raws:
        try:
          await _process_raw(raw_item)
        except Exception as exc:
          # _process_raw dispatches Telegram sends — redact.
          logger.error(
            "alert_consumer_single_failed — item skipped, continuing batch err=%s",
            redact_secrets(f"{type(exc).__name__}: {exc}"),
          )
    except Exception as exc:
      logger.error("alert_consumer_error — reconnecting in 5s err=%s", redact_secrets(f"{type(exc).__name__}: {exc}"))
      await asyncio.sleep(5)
      continue


# Module-level set to track pending delayed-send tasks across the lifespan.
# Must be module-level (not local to lifespan()) because _send_one references
# it and _send_one is lexically inside consume_alerts_forever, outside lifespan().
_pending_sends: set[asyncio.Task] = set()


@asynccontextmanager
async def lifespan(_: FastAPI):
  stop = asyncio.Event()
  global _REDIS_OK, _pending_sends
  _pending_sends = set()
  redis = None
  try:
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    await redis.ping()
    _REDIS_OK = True
    logger.info(
      "redis_connected host=%s queue=%s",
      _redact_netloc(settings.redis_url),
      settings.alert_created_queue,
    )
  except Exception:
    _REDIS_OK = False
    logger.exception("redis_unavailable host=%s", _redact_netloc(settings.redis_url))
  tasks: list[asyncio.Task] = []
  if not _REDIS_OK:
    try:
      yield
    finally:
      if redis is not None:
        await redis.aclose()
    return
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
    # Cancel and await any pending delayed sends (prevents alert loss on shutdown)
    for t in list(_pending_sends):
      t.cancel()
    if _pending_sends:
      await asyncio.gather(*_pending_sends, return_exceptions=True)
      logger.info("shutdown_cancelled_pending_sends count=%d", len(_pending_sends))
    await redis.aclose()


app = FastAPI(title="telegram-bot", lifespan=lifespan)

from shared.error_handlers import register_exception_handlers
register_exception_handlers(app)


@app.get("/health")
async def health():
  redis_ok = _REDIS_OK
  if redis_ok is None:
    redis_ok = False
  return {"status": "ok", "redis": "ok" if redis_ok else "unavailable"}

@app.get("/debug/build")
async def debug_build(x_admin_token: str | None = Header(None, alias="X-Admin-Token")):
  _require_admin(x_admin_token)
  keys = [
    "RENDER_GIT_COMMIT",
    "RENDER_SERVICE_ID",
    "RENDER_SERVICE_NAME",
    "RENDER_EXTERNAL_URL",
    "RENDER_INSTANCE_ID",
  ]
  env = {k: os.getenv(k) for k in keys if os.getenv(k)}
  admin_present = bool(getattr(settings, "admin_token", "") or "")
  return {
    "service": "telegram-bot",
    "env": env,
    "admin_debug": {
      "admin_token_present": admin_present,
    },
  }


@app.post("/alerts/test")
async def test_alert(
  message: str = Query("Test alert from SightWhale"),
  chat_id: str | None = Query(None, description="Target chat id; falls back to TELEGRAM_ALERT_CHAT_ID"),
  x_admin_token: str | None = Header(None, alias="X-Admin-Token"),
):
  _require_admin(x_admin_token)
  # F3: allow an operator to point a live end-to-end send at their own
  # telegram_id. Without this, an unset TELEGRAM_ALERT_CHAT_ID makes the
  # endpoint useless ("telegram_alert_config_missing") even though the bot
  # token is perfectly valid.
  target = (chat_id or "").strip() or str(settings.telegram_alert_chat_id or "").strip()
  if not settings.telegram_bot_token or not target:
    return {"ok": False, "error": "telegram_alert_config_missing"}
  url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
  payload = {
    "chat_id": target,
    "text": message,
    "parse_mode": "HTML",
    "disable_web_page_preview": True,
  }
  async with httpx.AsyncClient() as client:
    resp = await client.post(url, json=payload, timeout=10)
  if resp.status_code < 200 or resp.status_code >= 300:
    return {"ok": False, "status": resp.status_code, "body": redact_secrets(resp.text)[:200]}
  return {"ok": True}


@app.post("/admin/digest/now")
async def admin_digest_now(x_admin_token: str | None = Header(None, alias="X-Admin-Token")):
  """Manually push one public channel digest — pre-launch verification without
  waiting for the 09:00 Beijing schedule."""
  _require_admin(x_admin_token)

  from telegram import Bot as _Bot
  from services.telegram_bot.daily_vw_digest import send_channel_digest

  if not settings.telegram_bot_token:
    return {"ok": False, "error": "telegram_bot_token_missing"}
  if not str(settings.telegram_channel_id or "").strip():
    return {"ok": False, "skipped": True, "reason": "channel_not_configured"}

  bot = _Bot(settings.telegram_bot_token)
  try:
    result = await send_channel_digest(bot)
  except Exception as exc:
    logger.error("admin_digest_now_failed err=%s", redact_secrets(f"{type(exc).__name__}: {exc}"))
    return {"ok": False, "error": "digest_failed"}
  finally:
    try:
      await bot.shutdown()
    except Exception:
      pass

  return {"ok": bool(result.get("ok")), "result": result}


@app.get("/admin/diag/config")
async def admin_diag_config(x_admin_token: str | None = Header(None, alias="X-Admin-Token")):
  _require_admin(x_admin_token)

  from shared.async_utils import get_redis as _get_shared_redis
  redis = await _get_shared_redis()
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
