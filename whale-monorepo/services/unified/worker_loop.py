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
from shared.logging import configure_logging

logger = logging.getLogger("unified.worker_loop")


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
        except Exception:
            logger.exception("ingest_markets_failed")
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
        except Exception:
            logger.exception("ingest_trades_failed")
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
                continue

            payloads: list[dict] = []
            market_titles: dict[str, str] = {}

            for raw in raws:
                try:
                    p = json.loads(raw)
                except Exception:
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
                continue

            async with SessionLocal() as session:
                for mid, title in market_titles.items():
                    await session.execute(
                        insert(Market)
                        .values(id=mid, title=title)
                        .on_conflict_do_update(index_elements=[Market.id], set_={"title": title})
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
                "consume_incoming_trades_done received=%s inserted=%s",
                len(payloads),
                len(inserted),
            )
        except Exception:
            logger.exception("consume_incoming_trades_failed")
            await asyncio.sleep(batch_seconds)


async def rebuild_smart_collections_loop() -> None:
    """Periodically rebuild smart collections."""
    from services.trade_ingest.smart_collections import rebuild_smart_collections

    interval = float(os.getenv("REBUILD_SMART_COLLECTIONS_SECONDS", "86400"))
    logger.info("rebuild_smart_collections_loop_started interval=%ss", interval)

    # Initial delay to let the system warm up
    await asyncio.sleep(60)

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

    await asyncio.sleep(120)  # Initial delay

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

    await asyncio.sleep(300)  # Initial delay

    while True:
        try:
            started_at = datetime.now(timezone.utc)
            trade_id = f"health-test-{int(time.time())}"
            status = "OK"

            # In unified mode, all services are in-process — no HTTP calls needed
            # Just verify DB connectivity
            try:
                async with SessionLocal() as session:
                    from sqlalchemy import text
                    await session.execute(text("SELECT 1"))
            except Exception as e:
                status = f"FAIL:db={e}"

            logger.info("health_check_done status=%s trade_id=%s", status, trade_id)

            # Send Telegram notification if configured
            if settings.telegram_health_bot_token and settings.telegram_health_chat_id:
                await _send_health_telegram(trade_id, started_at, status)
        except Exception:
            logger.exception("health_check_failed")
        await asyncio.sleep(interval)


async def _send_health_telegram(trade_id: str, started_at: datetime, status: str) -> None:
    """Send health check result to Telegram."""
    token = settings.telegram_health_bot_token
    chat_id = settings.telegram_health_chat_id
    if not token or not chat_id:
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
            await client.post(url, json={"chat_id": chat_id, "text": text, "disable_web_page_preview": True}, timeout=10)
    except Exception:
        logger.exception("health_telegram_failed")


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
        except Exception:
            logger.exception("whale_consume_failed")
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
        except Exception:
            logger.exception("alert_consume_failed")
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

    await application.initialize()
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
