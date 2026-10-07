"""
Unified asyncio worker loops — replaces all Celery workers.

Each loop corresponds to one Celery Beat schedule in the old architecture.
All loops run as background asyncio tasks in the same event loop.
Communication is via the shared InMemoryRedis instance.

The business logic functions (ingest_markets, process_trade_id, etc.) are
imported and called directly — they remain unchanged.
"""

import asyncio
import json
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import httpx

from shared.config import get_alert_config, settings
from shared.db import SessionLocal
from shared.logging import configure_logging, redact_secrets

logger = logging.getLogger("unified.worker_loop")


def _chat_tail(chat_id: str) -> str:
    """Last 4 digits of a chat id, for logs. The full id is not a secret but the
    token is, and this keeps the two visually distinct."""
    return chat_id[-4:] if len(chat_id) > 4 else "???"

# ── Warm-up delays (seconds before first run of periodic tasks) ──
_INITIAL_DELAY_SMART_COLLECTIONS = 60       # let system warm up before rebuilding collections
_INITIAL_DELAY_LEADERBOARD = 120            # let markets ingest before leaderboard fetch
_INITIAL_DELAY_HEALTH_CHECK = 300           # let all services stabilize before health ping

# ── Worker heartbeat tracking ─────────────────────────────────
# Each worker updates its heartbeat timestamp after completing
# one iteration. The health endpoint reads these to detect stuck loops.

_worker_heartbeats: dict[str, float] = {}
_worker_has_error: dict[str, bool] = {}


def _beat(name: str) -> None:
    """Record a heartbeat for a worker loop.

    F4: a successful heartbeat also clears the worker's error latch. Without
    this, `_err()` is permanent — a single transient failure keeps
    `has_error: true` for the lifetime of the process, so /health becomes a
    false-positive alarm that operators learn to ignore. The latch now means
    "the *last* iteration failed", which is what the health check needs.
    """
    _worker_heartbeats[name] = time.monotonic()
    _worker_has_error[name] = False


def _err(name: str) -> None:
    """Record that a worker loop encountered an error (cleared by the next _beat)."""
    _worker_has_error[name] = True


def get_worker_status() -> dict:
    """Return heartbeat age and error flag for each worker loop (for health checks).

    Does NOT expose error messages — only boolean error flag to avoid
    leaking internal state via unauthenticated health endpoint.
    """
    now = time.monotonic()
    status = {}
    for name, ts in _worker_heartbeats.items():
        status[name] = {
            "last_beat_sec": round(now - ts, 1),
            "has_error": _worker_has_error.get(name, False),
        }
    return status


# ═══════════════════════════════════════════════════════════════
# Trade Ingest Workers
# ═══════════════════════════════════════════════════════════════


async def _get_inmem_redis():
    """Get the shared InMemoryRedis instance."""
    from shared.async_utils import get_redis
    return await get_redis()


async def ingest_markets_loop() -> None:
    """Periodically ingest markets from Polymarket (replaces Celery beat)."""
    from services.trade_ingest.markets import ingest_markets

    interval = float(os.getenv("MARKET_INGEST_SECONDS", "120"))
    logger.info("ingest_markets_loop_started interval=%ss", interval)

    while True:
        try:
            async with SessionLocal() as session:
                n = await ingest_markets(session)
                await session.commit()
            if n > 0:
                logger.info("ingest_markets_done count=%s", n)
            _beat("ingest_markets")
        except Exception as e:
            logger.exception("ingest_markets_failed")
            _err("ingest_markets")
        await asyncio.sleep(interval)


async def ingest_trades_loop() -> None:
    """Periodically ingest trades from Polymarket (replaces Celery beat)."""
    from services.trade_ingest.polymarket import ingest_trades
    from shared.models import TradeRaw
    from sqlalchemy import select

    interval = float(os.getenv("TRADE_INGEST_SECONDS", "30"))
    logger.info("ingest_trades_loop_started interval=%ss", interval)

    redis = await _get_inmem_redis()

    while True:
        try:
            async with SessionLocal() as session:
                trade_ids = await ingest_trades(session)
                await session.commit()

                if trade_ids:
                    # Cache recent trades
                    rows = (
                        await session.execute(
                            select(TradeRaw).where(TradeRaw.trade_id.in_(list(trade_ids)))
                        )
                    ).scalars().all()
                    for r in rows:
                        await _cache_trade(redis, r)

            if trade_ids:
                messages = [json.dumps({"trade_id": tid}) for tid in trade_ids]
                for i in range(0, len(messages), 50):
                    chunk = messages[i : i + 50]
                    await redis.rpush(settings.trade_created_queue, *chunk)

            if trade_ids:
                logger.info("ingest_trades_done count=%s", len(trade_ids))
            _beat("ingest_trades")
        except Exception as e:
            logger.exception("ingest_trades_failed")
            _err("ingest_trades")
        await asyncio.sleep(interval)


async def _cache_trade(redis, trade_row) -> None:
    """Cache a trade row for the /analyze page."""
    wallet = str(getattr(trade_row, "wallet", "") or "").lower()
    market_id = str(getattr(trade_row, "market_id", "") or "")
    if not wallet or not market_id:
        return
    ts = getattr(trade_row, "timestamp", None) or datetime.now(timezone.utc)
    body = {
        "timestamp": ts.isoformat() if hasattr(ts, "isoformat") else str(ts),
        "side": getattr(trade_row, "side", None),
        "amount": float(getattr(trade_row, "amount", 0) or 0),
        "price": float(getattr(trade_row, "price", 0) or 0),
    }
    key = f"recent_trades:{wallet}:{market_id}"
    try:
        await redis.rpush(key, json.dumps(body))
        await redis.ltrim(key, -settings.recent_trades_cache_max, -1)
        await redis.expire(key, settings.recent_trades_cache_seconds)
    except Exception:
        logger.debug("cache_trade_failed trade_id=%s", getattr(trade_row, "trade_id", "?"), exc_info=True)


async def consume_incoming_trades_loop() -> None:
    """Consume trades from the incoming queue and publish to trade_created."""
    from sqlalchemy.dialects.postgresql import insert
    from shared.models import Market, TradeRaw

    batch_seconds = float(os.getenv("TRADE_INGEST_BATCH_SECONDS", "3"))
    batch_size = max(1, settings.trade_ingest_batch_size)
    incoming_queue = settings.trade_ingest_incoming_queue
    processing_key = f"{incoming_queue}:processing"

    logger.info("consume_incoming_trades_loop_started batch_s=%s batch_size=%s", batch_seconds, batch_size)

    redis = await _get_inmem_redis()

    while True:
        try:
            # Simple non-blocking drain (InMemoryRedis blpop timeout semantics
            # are handled internally)
            raws: list[str] = []
            for _ in range(batch_size):
                item = await redis.lpop(incoming_queue)
                if not item:
                    break
                raws.append(item)

            if not raws:
                await asyncio.sleep(batch_seconds)
                _beat("consume_incoming")  # idle heartbeat
                continue

            payloads: list[dict] = []
            market_titles: dict[str, str] = {}

            parse_failures = 0
            for raw in raws:
                try:
                    p = json.loads(raw)
                except Exception:
                    parse_failures += 1
                    continue
                trade_id = str(p.get("trade_id") or "")
                market_id = str(p.get("market_id") or "")
                outcome = (
                    p.get("outcome")
                    or p.get("outcome_name")
                    or p.get("outcomeName")
                    or p.get("tokenOutcome")
                    or p.get("outcomeToken")
                    or p.get("outcome_token")
                    or p.get("label")
                    or p.get("name")
                )
                if isinstance(outcome, dict):
                    outcome = (
                        outcome.get("outcome")
                        or outcome.get("outcome_name")
                        or outcome.get("outcomeName")
                        or outcome.get("tokenOutcome")
                        or outcome.get("outcomeToken")
                        or outcome.get("outcome_token")
                        or outcome.get("label")
                        or outcome.get("name")
                    )
                wallet = str(p.get("wallet") or "").lower()
                side = str(p.get("side") or "").lower()
                amount = float(p.get("amount") or 0)
                price = float(p.get("price") or 0)
                ts_value = p.get("timestamp")
                if isinstance(ts_value, datetime):
                    ts = ts_value
                elif isinstance(ts_value, str):
                    try:
                        ts = datetime.fromisoformat(ts_value)
                    except Exception:
                        ts = datetime.now(timezone.utc)
                else:
                    ts = datetime.now(timezone.utc)
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)

                if not trade_id or not market_id or not wallet:
                    continue
                if outcome is not None and not str(outcome).strip():
                    outcome = None

                payload = {
                    "trade_id": trade_id,
                    "market_id": market_id,
                    "outcome": outcome,
                    "wallet": wallet,
                    "side": side or "buy",
                    "amount": amount,
                    "price": price,
                    "timestamp": ts,
                    "market_title": p.get("market_title"),
                }
                payloads.append(payload)
                title = str(p.get("market_title") or "")
                if title:
                    market_titles[market_id] = title

            if not payloads:
                if parse_failures:
                    logger.warning("consume_incoming_parse_failures count=%d", parse_failures)
                continue

            async with SessionLocal() as session:
                for mid, title in market_titles.items():
                    await session.execute(
                        insert(Market)
                        .values(id=mid, title=title)
                        .on_conflict_do_nothing(index_elements=[Market.id])
                    )

                stmt = (
                    insert(TradeRaw)
                    .values(payloads)
                    .on_conflict_do_nothing(index_elements=[TradeRaw.trade_id])
                    .returning(TradeRaw.trade_id)
                )
                inserted = (await session.execute(stmt)).scalars().all()
                await session.commit()

            if inserted:
                await redis.rpush(
                    settings.trade_created_queue,
                    *[json.dumps({"trade_id": tid}) for tid in inserted],
                )
                inserted_set = set(str(t) for t in inserted)
                for p in payloads:
                    if p["trade_id"] in inserted_set:
                        cache_key = f"recent_trades:{p['wallet']}:{p['market_id']}"
                        await redis.rpush(
                            cache_key,
                            json.dumps({
                                "timestamp": p["timestamp"].isoformat(),
                                "side": p["side"],
                                "amount": p["amount"],
                                "price": p["price"],
                            }),
                        )
                        await redis.ltrim(cache_key, -settings.recent_trades_cache_max, -1)
                        await redis.expire(cache_key, settings.recent_trades_cache_seconds)

            logger.info(
                "consume_incoming_trades_done received=%s inserted=%s parse_failures=%s",
                len(payloads),
                len(inserted),
                parse_failures,
            )
            _beat("consume_incoming")
        except Exception as e:
            logger.exception("consume_incoming_trades_failed")
            _err("consume_incoming")
            await asyncio.sleep(batch_seconds)


async def rebuild_smart_collections_loop() -> None:
    """Periodically rebuild smart collections."""
    from services.trade_ingest.smart_collections import rebuild_smart_collections

    interval = float(os.getenv("REBUILD_SMART_COLLECTIONS_SECONDS", "86400"))
    logger.info("rebuild_smart_collections_loop_started interval=%ss", interval)

    # Initial delay to let the system warm up
    await asyncio.sleep(_INITIAL_DELAY_SMART_COLLECTIONS)

    while True:
        try:
            async with SessionLocal() as session:
                n = await rebuild_smart_collections(session)
                await session.commit()
            logger.info("rebuild_smart_collections_done count=%s", n)
        except Exception:
            logger.exception("rebuild_smart_collections_failed")
        await asyncio.sleep(interval)


async def ingest_smart_money_leaderboard_loop() -> None:
    """Periodically ingest smart money leaderboard."""
    from services.trade_ingest.polymarket import ingest_smart_money_leaderboard

    interval = float(os.getenv("INGEST_LEADERBOARD_SECONDS", "43200"))
    logger.info("ingest_leaderboard_loop_started interval=%ss", interval)

    await asyncio.sleep(_INITIAL_DELAY_LEADERBOARD)  # Initial delay

    while True:
        try:
            async with SessionLocal() as session:
                n = await ingest_smart_money_leaderboard(
                    session, category="OVERALL", time_period="MONTH", order_by="PNL", limit=50
                )
                await session.commit()
            logger.info("ingest_leaderboard_done count=%s", n)
        except Exception:
            logger.exception("ingest_leaderboard_failed")
        await asyncio.sleep(interval)


async def health_check_loop() -> None:
    """Periodic full-chain health check."""
    interval = float(os.getenv("HEALTH_CHECK_SECONDS", "3600"))
    logger.info("health_check_loop_started interval=%ss", interval)

    await asyncio.sleep(_INITIAL_DELAY_HEALTH_CHECK)  # Initial delay

    while True:
        try:
            started_at = datetime.now(timezone.utc)
            check_id = f"health-check-{int(time.time())}"
            status = "OK"

            # In unified mode, all services are in-process — no HTTP calls needed
            # Just verify DB connectivity
            try:
                async with SessionLocal() as session:
                    from sqlalchemy import text
                    await session.execute(text("SELECT 1"))
            except Exception as e:
                status = f"FAIL:db={e}"

            logger.info("health_check_done status=%s check_id=%s", status, check_id)

            # Send Telegram notification if configured
            if settings.telegram_health_bot_token and settings.telegram_health_chat_id:
                await _send_health_telegram(check_id, started_at, status)
            else:
                # D6: the *absence* of the canary must itself be visible.
                # Previously this branch was silent, so "the hourly check never
                # arrived" left no trace in the logs at all — the one symptom
                # an operator would notice was the one thing never recorded.
                logger.warning(
                    "health_telegram_not_configured has_token=%s has_chat_id=%s",
                    bool(settings.telegram_health_bot_token),
                    bool(settings.telegram_health_chat_id),
                )
        except Exception:
            logger.exception("health_check_failed")
        await asyncio.sleep(interval)


async def _send_health_telegram(trade_id: str, started_at: datetime, status: str) -> None:
    """Send health check result to Telegram.

    D6: the Telegram Bot API answers 4xx/5xx *without raising*, so a bare
    ``httpx.post`` discards every rejection silently — 403 ("bot can't initiate
    conversation with a user", i.e. nobody pressed /start for THIS bot), 401
    (bad token) and 400 (bad chat_id) all look identical to success. This canary
    is the operator's only signal that the chain is alive, so its own failures
    must be loud, not merely non-silent.
    """
    token = settings.telegram_health_bot_token
    chat_id = settings.telegram_health_chat_id
    if not token or not chat_id:
        logger.warning(
            "health_telegram_skipped reason=not_configured has_token=%s has_chat_id=%s",
            bool(token),
            bool(chat_id),
        )
        return

    lines = [
        "🩺 全链路检查结果: {}".format(status),
        "时间(UTC): {}".format(started_at.isoformat()),
        "模式: unified (in-memory)",
        "测试交易ID: {}".format(trade_id),
    ]
    text = "\n".join(lines)
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                url,
                json={"chat_id": chat_id, "text": text, "disable_web_page_preview": True},
                timeout=10,
            )
    except Exception as exc:
        # Deliberately NOT logging the URL — it contains the Telegram bot token
        logger.error(
            "health_telegram_failed chat_id=***%s err=%s",
            _chat_tail(chat_id),
            redact_secrets(f"{type(exc).__name__}: {exc}"),
        )
        return

    if resp.status_code == 200:
        logger.info("health_telegram_sent chat_id=***%s status=%s", _chat_tail(chat_id), status)
        return

    # Telegram replies {"ok":false,"error_code":403,"description":"..."}.
    # The description is what turns "没收到" into an actionable cause, so surface it.
    description = ""
    try:
        payload = resp.json()
        if isinstance(payload, dict):
            description = str(payload.get("description") or "")
    except Exception:
        description = ""
    logger.error(
        "health_telegram_rejected http_status=%s chat_id=***%s desc=%s",
        resp.status_code,
        _chat_tail(chat_id),
        redact_secrets(description)[:200] or "<no description>",
    )


async def daily_spotlight_loop() -> None:
    """Daily spotlight — runs at configured time (default 20:00 Beijing)."""
    logger.info("daily_spotlight_loop_started target_hour=20 (Beijing)")

    while True:
        now_bj = datetime.now(ZoneInfo("Asia/Shanghai"))
        # Calculate seconds until next 20:00
        target = now_bj.replace(hour=20, minute=0, second=0, microsecond=0)
        if now_bj >= target:
            target += timedelta(days=1)
        wait_seconds = (target - now_bj).total_seconds()
        logger.info("daily_spotlight_next_run in=%ss at=%s", wait_seconds, target.isoformat())
        await asyncio.sleep(wait_seconds)

        # Delay slightly so the daily article task (20:05) doesn't conflict
        try:
            from services.trade_ingest.worker import run_daily_spotlight
            result = await run_daily_spotlight()
            logger.info("daily_spotlight_done result=%s", result)
        except Exception:
            logger.exception("daily_spotlight_failed")


async def generate_daily_article_loop() -> None:
    """Generate daily AI blog article at 20:05 Beijing time."""
    logger.info("generate_daily_article_loop_started target_hour=20:05 (Beijing)")

    while True:
        now_bj = datetime.now(ZoneInfo("Asia/Shanghai"))
        target = now_bj.replace(hour=20, minute=5, second=0, microsecond=0)
        if now_bj >= target:
            target += timedelta(days=1)
        wait_seconds = (target - now_bj).total_seconds()
        await asyncio.sleep(wait_seconds)

        if not settings.blog_daily_enabled:
            continue

        # Skip if today is not a configured generation day
        today_abbr = now_bj.strftime("%a").lower()[:3]  # "mon", "tue", etc.
        if today_abbr not in settings.blog_generation_days:
            logger.info(
                "generate_daily_article_skipped day=%s not in generation_days=%s",
                today_abbr, settings.blog_generation_days,
            )
            continue

        try:
            from services.trade_ingest.blog_generator import generate_daily_article
            result = await generate_daily_article()
            logger.info("generate_daily_article_done result=%s", result)
        except Exception:
            logger.exception("generate_daily_article_failed")


# ═══════════════════════════════════════════════════════════════
# Whale Engine Workers
# ═══════════════════════════════════════════════════════════════


async def whale_consume_trade_created_loop() -> None:
    """Consume trade_created queue and identify whale trades."""
    from services.whale_engine.engine import process_trade_id

    poll_interval = float(os.getenv("WHALE_CONSUME_SECONDS", "1"))
    batch_size = int(os.getenv("TRADE_CONSUME_BATCH", "50"))
    logger.info("whale_consume_loop_started poll_s=%s batch=%s", poll_interval, batch_size)

    redis = await _get_inmem_redis()

    while True:
        try:
            # BLPOP with 1s timeout
            item = await redis.blpop(settings.trade_created_queue, timeout=1)
            if not item:
                _beat("whale_consume")  # idle heartbeat
                continue

            _, raw = item
            raws = [raw]
            # Drain remaining
            for _ in range(batch_size - 1):
                nxt = await redis.lpop(settings.trade_created_queue)
                if not nxt:
                    break
                raws.append(nxt)

            created_count = 0
            events: list[dict] = []
            async with SessionLocal() as session:
                for payload in raws:
                    try:
                        msg = json.loads(payload)
                        trade_id = str(msg.get("trade_id") or "")
                        if not trade_id:
                            continue
                        created, event = await process_trade_id(session, redis, trade_id)
                        if created and event is not None:
                            created_count += 1
                            events.append(event)
                    except Exception:
                        logger.exception("whale_consume_failed_single payload=%s", payload[:200])
                await session.commit()

            if events:
                for i in range(0, len(events), 50):
                    chunk = events[i : i + 50]
                    chunk_raw = [json.dumps(e) for e in chunk]
                    await redis.rpush(settings.whale_trade_created_queue, *chunk_raw)

            if raws:
                logger.info("whale_consume_done received=%s created=%s", len(raws), created_count)
            _beat("whale_consume")
        except Exception as e:
            logger.exception("whale_consume_failed")
            _err("whale_consume")
            await asyncio.sleep(1)


async def recompute_whale_stats_loop() -> None:
    """Periodically recompute whale stats."""
    from services.whale_engine.engine import recompute_whale_stats

    interval = float(os.getenv("WHALE_RECOMPUTE_SECONDS", "300"))
    logger.info("recompute_whale_stats_loop_started interval=%ss", interval)

    while True:
        try:
            async with SessionLocal() as session:
                n = await recompute_whale_stats(session)
                await session.commit()
            if n > 0:
                logger.info("recompute_whale_stats_done count=%s", n)
        except Exception:
            logger.exception("recompute_whale_stats_failed")
        await asyncio.sleep(interval)


async def compute_vw_metrics_loop() -> None:
    """Periodically compute volume-weighted metrics."""
    from services.whale_engine.vw import compute_vw_metrics

    interval = float(os.getenv("VW_COMPUTE_SECONDS", "3600"))
    logger.info("compute_vw_metrics_loop_started interval=%ss", interval)

    redis = await _get_inmem_redis()

    while True:
        try:
            config = get_alert_config().get("vw_analysis", {})
            async with SessionLocal() as session:
                n = await compute_vw_metrics(session, redis, config)
                await session.commit()
            if n > 0:
                logger.info("compute_vw_metrics_done count=%s", n)
        except Exception:
            logger.exception("compute_vw_metrics_failed")
        await asyncio.sleep(interval)


async def prune_vw_snapshots_loop() -> None:
    """Periodically prune old VW snapshots."""
    from services.whale_engine.vw import prune_vw_snapshots

    interval = float(os.getenv("VW_PRUNE_SECONDS", "86400"))
    logger.info("prune_vw_snapshots_loop_started interval=%ss", interval)

    while True:
        try:
            config = get_alert_config().get("vw_analysis", {})
            async with SessionLocal() as session:
                n = await prune_vw_snapshots(session, config)
                await session.commit()
            if n > 0:
                logger.info("prune_vw_snapshots_done count=%s", n)
        except Exception:
            logger.exception("prune_vw_snapshots_failed")
        await asyncio.sleep(interval)


# ═══════════════════════════════════════════════════════════════
# Raw trades retention
# ═══════════════════════════════════════════════════════════════


async def prune_trades_raw_loop() -> None:
    """Periodically delete trades_raw rows older than the retention window.

    trades_raw grows ~30k rows/day with no other retention mechanism. In
    2026-08 it hit 9M rows / 7GB: every market_id lookup seq-scanned the
    table for 15+ minutes and startup reconciliation hung the deploy.
    Batched deletes use the timestamp index; each statement is bounded
    server-side so a slow plan fails fast instead of stalling the worker.
    """
    from sqlalchemy import delete, select, text

    from shared.models import TradeRaw

    interval = float(os.getenv("TRADES_RAW_PRUNE_SECONDS", "86400"))
    retention_days = float(os.getenv("TRADES_RAW_RETENTION_DAYS", "90"))
    batch_size = int(os.getenv("TRADES_RAW_PRUNE_BATCH", "20000"))
    max_batches_per_cycle = int(os.getenv("TRADES_RAW_PRUNE_MAX_BATCHES", "10"))
    # A failed cycle must not cost a whole day. The first cycle used to run the
    # instant the loop started — i.e. exactly while every other worker was
    # booting and the cache was cold — so the backlog DELETE could exceed its
    # 30s statement_timeout. The exception then slept the full `interval`
    # (24h), leaving the table un-pruned for a day.
    startup_delay = float(os.getenv("TRADES_RAW_PRUNE_STARTUP_DELAY_SECONDS", "120"))
    retry_interval = float(os.getenv("TRADES_RAW_PRUNE_RETRY_SECONDS", "300"))
    logger.info(
        "prune_trades_raw_loop_started interval=%ss retention=%sd batch=%s startup_delay=%ss retry=%ss",
        interval, retention_days, batch_size, startup_delay, retry_interval,
    )

    await asyncio.sleep(startup_delay)
    while True:
        sleep_for = interval
        try:
            total = 0
            for _ in range(max_batches_per_cycle):
                async with SessionLocal() as session:
                    await session.execute(text("SET LOCAL statement_timeout = 30000"))
                    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
                    ids = (
                        await session.execute(
                            select(TradeRaw.trade_id)
                            .where(TradeRaw.timestamp < cutoff)
                            .order_by(TradeRaw.timestamp)
                            .limit(batch_size)
                        )
                    ).scalars().all()
                    if not ids:
                        await session.rollback()
                        break
                    await session.execute(
                        delete(TradeRaw).where(TradeRaw.trade_id.in_(ids))
                    )
                    await session.commit()
                    total += len(ids)
                    await asyncio.sleep(0.2)
            if total:
                logger.info("prune_trades_raw_done count=%s", total)
        except Exception:
            logger.exception("prune_trades_raw_failed retry_in=%ss", retry_interval)
            sleep_for = retry_interval
        await asyncio.sleep(sleep_for)


# ═══════════════════════════════════════════════════════════════
# Alert Engine Worker
# ═══════════════════════════════════════════════════════════════


async def alert_consume_whale_trade_loop() -> None:
    """Consume whale_trade_created queue and generate alerts."""
    from services.alert_engine.engine import process_whale_trade_event

    poll_interval = float(os.getenv("ALERT_CONSUME_SECONDS", "1"))
    batch_size = int(os.getenv("ALERT_CONSUME_BATCH_SIZE", str(settings.alert_consume_batch_size)))
    logger.info("alert_consume_loop_started poll_s=%s batch=%s", poll_interval, batch_size)

    redis = await _get_inmem_redis()

    while True:
        try:
            item = await redis.blpop(settings.whale_trade_created_queue, timeout=1)
            if not item:
                _beat("alert_consume")  # idle heartbeat
                continue

            _, raw = item
            raws = [raw]
            for _ in range(batch_size - 1):
                nxt = await redis.lpop(settings.whale_trade_created_queue)
                if not nxt:
                    break
                raws.append(nxt)

            created_count = 0
            async with SessionLocal() as session:
                for payload in raws:
                    try:
                        event = json.loads(payload)
                        created = await process_whale_trade_event(session, redis, event)
                        if created:
                            created_count += 1
                    except Exception:
                        logger.exception("alert_consume_failed_single")
                await session.commit()

            if created_count > 0:
                logger.info("alert_consume_done received=%s created=%s", len(raws), created_count)
            _beat("alert_consume")
        except Exception as e:
            logger.exception("alert_consume_failed")
            _err("alert_consume")
            await asyncio.sleep(1)


# ═══════════════════════════════════════════════════════════════
# Telegram Bot Workers (from telegram_bot/api.py lifespan)
# ═══════════════════════════════════════════════════════════════


async def telegram_alert_consumer_loop(application, stop: asyncio.Event) -> None:
    """Consume alert_created queue and deliver to Telegram subscribers.

    This is the core delivery loop extracted from telegram_bot/api.py's
    consume_alerts_forever(). It imports the inner _process_raw logic
    and runs it as an asyncio task.
    """
    from services.telegram_bot.api import consume_alerts_forever as _original_consumer

    redis = await _get_inmem_redis()
    await _original_consumer(stop, redis, application)


async def telegram_bot_runtime_loop(application, stop: asyncio.Event) -> None:
    """Manage Telegram bot polling lifecycle (distributed lock unnecessary in unified mode)."""
    from services.telegram_bot.bot import _COMMANDS

    try:
        # Bot.initialize() validates the token by calling getMe(). A rotated or
        # revoked token therefore fails HERE — and without this guard the task
        # would die silently: polling never starts, the stale tg_users rows stay
        # behind, and the only symptom is "alerts stopped arriving".
        await application.initialize()
    except Exception as exc:
        logger.error(
            "telegram_bot_initialize_failed err=%s",
            redact_secrets(f"{type(exc).__name__}: {exc}"),
        )
        raise
    await application.start()
    await application.bot.set_my_commands(_COMMANDS)

    # In unified mode, there's only one instance — no need for distributed lock
    try:
        await application.updater.start_polling(allowed_updates=["message", "callback_query"])
        logger.info("bot_polling_started_unified")
        await stop.wait()
    finally:
        try:
            await application.updater.stop()
        except Exception:
            pass
        await application.stop()
        await application.shutdown()


async def subscriber_stats_loop(stop: asyncio.Event) -> None:
    """Log subscriber stats periodically."""
    from sqlalchemy import func, select
    from shared.models import Subscription

    while not stop.is_set():
        try:
            now = datetime.now(timezone.utc)
            async with SessionLocal() as session:
                total = (await session.execute(
                    select(func.count()).select_from(Subscription)
                )).scalar_one()
                active = (await session.execute(
                    select(func.count())
                    .select_from(Subscription)
                    .where(Subscription.status.in_(["active", "trialing"]))
                    .where(Subscription.current_period_end > now)
                )).scalar_one()
            logger.info("subscription_stats total=%s active=%s", int(total), int(active))
        except Exception:
            logger.exception("subscription_stats_failed")

        try:
            await asyncio.wait_for(stop.wait(), timeout=600)
        except asyncio.TimeoutError:
            continue


# ═══════════════════════════════════════════════════════════════
# Launcher
# ═══════════════════════════════════════════════════════════════


async def start_all_workers(application=None, stop: asyncio.Event | None = None) -> list[asyncio.Task]:
    """Start all background worker loops as asyncio tasks.

    Args:
        application: python-telegram-bot Application instance (required for
                     Telegram workers; if None, Telegram workers are skipped).
        stop: Event to signal shutdown (required if application is provided).

    Returns:
        List of running asyncio Tasks.
    """
    tasks: list[asyncio.Task] = []

    # Trade Ingest
    tasks.append(asyncio.create_task(ingest_markets_loop(), name="ingest_markets"))
    tasks.append(asyncio.create_task(ingest_trades_loop(), name="ingest_trades"))
    tasks.append(asyncio.create_task(consume_incoming_trades_loop(), name="consume_incoming"))
    tasks.append(asyncio.create_task(rebuild_smart_collections_loop(), name="rebuild_smart"))
    tasks.append(asyncio.create_task(ingest_smart_money_leaderboard_loop(), name="ingest_leaderboard"))
    tasks.append(asyncio.create_task(health_check_loop(), name="health_check"))
    tasks.append(asyncio.create_task(daily_spotlight_loop(), name="daily_spotlight"))
    tasks.append(asyncio.create_task(generate_daily_article_loop(), name="daily_article"))

    # Whale Engine
    tasks.append(asyncio.create_task(whale_consume_trade_created_loop(), name="whale_consume"))
    tasks.append(asyncio.create_task(recompute_whale_stats_loop(), name="whale_stats"))
    tasks.append(asyncio.create_task(compute_vw_metrics_loop(), name="vw_metrics"))
    tasks.append(asyncio.create_task(prune_vw_snapshots_loop(), name="vw_prune"))
    tasks.append(asyncio.create_task(prune_trades_raw_loop(), name="trades_raw_prune"))

    # Alert Engine
    tasks.append(asyncio.create_task(alert_consume_whale_trade_loop(), name="alert_consume"))

    # Telegram Bot
    if application is not None and stop is not None:
        tasks.append(asyncio.create_task(
            telegram_bot_runtime_loop(application, stop), name="bot_runtime"
        ))
        tasks.append(asyncio.create_task(
            telegram_alert_consumer_loop(application, stop), name="alert_consumer"
        ))
        tasks.append(asyncio.create_task(
            subscriber_stats_loop(stop), name="subscriber_stats"
        ))

    logger.info("all_workers_started count=%s names=%s", len(tasks), [t.get_name() for t in tasks])
    return tasks
