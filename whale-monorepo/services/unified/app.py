"""
Unified SightWhale application — single FastAPI process replacing 8 microservices.

Mounts all sub-API routers and runs all background workers as asyncio tasks.
Uses InMemoryRedis instead of an external Redis server.
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI

from shared.config import settings
from shared.logging import configure_logging


configure_logging(settings.log_level)
logger = logging.getLogger("unified.app")


# ═══════════════════════════════════════════════════════════════
# NOTE: there is deliberately NO module-level pending-send set here.
# In unified mode the Telegram send paths live in
# services.telegram_bot.api, so that module's `_pending_sends` is the
# single source of truth. A second set in this file would never be
# populated (api.py's lifespan, which rebinds it, is not used here) and
# would silently make shutdown a no-op. The shutdown handler below drains
# the live set via the api module attribute.
# ═══════════════════════════════════════════════════════════════


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init memory store, mount workers, init Telegram bot.
    Shutdown: cancel all background tasks gracefully.
    """
    logger.info("unified_lifespan_startup")

    # ── Initialize InMemoryRedis ────────────────────────────
    from services.unified.memory_store import InMemoryRedis
    memory_redis = InMemoryRedis(decode_responses=True)

    # Patch shared.get_redis to return our instance
    import shared.async_utils as _async_utils
    _async_utils._redis = memory_redis  # type: ignore[attr-defined]
    logger.info("inmemory_redis_initialized")

    # NOTE: blog_posts schema is owned by Alembic (migration 0018). The
    # entrypoint runs `alembic upgrade head` before uvicorn, so no runtime
    # DDL here (CR-S1).

    # ── Initialize Telegram bot ─────────────────────────────
    stop = asyncio.Event()
    telegram_ready = False
    application = None
    if settings.telegram_bot_token:
        try:
            from services.telegram_bot.bot import build_application
            application = await build_application()
            telegram_ready = True
            logger.info("telegram_bot_initialized")
        except Exception:
            logger.exception("telegram_bot_init_failed")
    else:
        logger.warning("telegram_bot_token_missing — Telegram disabled")

    # ── Start background workers ────────────────────────────
    from services.unified.worker_loop import start_all_workers
    worker_tasks = await start_all_workers(
        application=application if telegram_ready else None,
        stop=stop if telegram_ready else None,
    )

    # ── Reconcile lost in-memory queue events after restart (CR-R1) ──
    # The in-memory queues die with the previous process; re-enqueue whatever
    # the DB proves is still outstanding. Idempotent by unique constraints.
    try:
        from services.unified.reconcile import reconcile_pipeline_on_startup
        await reconcile_pipeline_on_startup(memory_redis)
    except Exception:
        logger.exception("pipeline_reconciliation_failed")

    # Store references for access in request handlers
    app.state.memory_redis = memory_redis
    app.state.telegram_app = application

    try:
        yield
    finally:
        logger.info("unified_lifespan_shutdown")
        stop.set()

        # Cancel worker tasks
        for t in worker_tasks:
            t.cancel()
        if worker_tasks:
            await asyncio.gather(*worker_tasks, return_exceptions=True)
            logger.info("workers_cancelled count=%d", len(worker_tasks))

        # Cancel pending Telegram delayed sends. In unified mode the send
        # paths run out of services.telegram_bot.api, so the live task set is
        # that module's `_pending_sends`. Read it via the MODULE attribute (not
        # `from ... import _pending_sends`, which would snapshot the object and
        # miss api.py's lifespan rebind) so we always drain the real set.
        import services.telegram_bot.api as _tg_api
        _pending = list(getattr(_tg_api, "_pending_sends", ()) or ())
        for t in _pending:
            t.cancel()
        if _pending:
            await asyncio.gather(*_pending, return_exceptions=True)
            logger.info("pending_sends_cancelled count=%d", len(_pending))

        # Close InMemoryRedis (no-op but for API compatibility)
        await memory_redis.aclose()


# ═══════════════════════════════════════════════════════════════
# Main Application
# ═══════════════════════════════════════════════════════════════

app = FastAPI(title="sightwhale", lifespan=lifespan)

from shared.error_handlers import register_exception_handlers
register_exception_handlers(app)

# ═══════════════════════════════════════════════════════════════
# IMPORTANT: Starlette matches routes in REGISTRATION ORDER.
# The most-specific routes come FIRST, catch-all mount "/" comes LAST.
# Otherwise mount("/") swallows every request before other routes see it.
# ═══════════════════════════════════════════════════════════════

# ── Phase 1: Explicit routes on the parent app ────────────

@app.get("/health")
async def root_health():
    """Primary health check. Must be registered before mount("/")."""
    import time
    from datetime import datetime, timezone

    worker_count = len([t for t in asyncio.all_tasks()
                        if hasattr(t, 'get_name') and not t.get_name().startswith('Task-')])

    # ── Pipeline health: check if alerts were created recently ──
    # Bounded to 3s so the health endpoint can never hang the deploy
    # (Render health-check timeouts leave zombie instances that then
    # double-poll Telegram) (CR-H2).
    pipeline_status = "unknown"
    last_alert_age_min = None

    async def _query_latest_alert():
        from shared.db import SessionLocal
        from shared.models import Alert
        from sqlalchemy import select, func
        async with SessionLocal() as session:
            return (await session.execute(
                select(func.max(Alert.created_at))
            )).scalar()

    try:
        latest = await asyncio.wait_for(_query_latest_alert(), timeout=3)
        if latest:
            age_min = (datetime.now(timezone.utc) - latest).total_seconds() / 60
            last_alert_age_min = round(age_min, 1)
            if age_min <= 30:
                pipeline_status = "ok"
            elif age_min <= 120:
                pipeline_status = "slow"
            else:
                pipeline_status = "stale"
        else:
            pipeline_status = "no_alerts"
            last_alert_age_min = None
    except Exception:
        pipeline_status = "error"

    # ── Worker heartbeats ─────────────────────────────────────
    from services.unified.worker_loop import get_worker_status
    worker_beats = get_worker_status()

    # Flag stale workers (>5 min without heartbeat = potentially stuck).
    # The 300s threshold is fine for every loop that actually beats:
    # ingest_trades ~30s, ingest_markets ~120s, and consume_incoming /
    # whale_consume / alert_consume idle-beat every 1-3s.
    # NOTE (F4): loops that never call _beat() are invisible here — whale_stats
    # (300s), vw_metrics (3600s), vw_prune (86400s), rebuild_smart (86400s),
    # ingest_leaderboard (43200s), health_check (3600s) and the prunes/digests.
    # If any of them start heart-beating, this single 300s threshold would
    # misfire for the hourly/daily loops and must become per-loop. Not changed
    # here on purpose — only annotated.
    now_mono = time.monotonic()
    stale_workers = [
        name for name, info in worker_beats.items()
        if info["last_beat_sec"] > 300
    ]

    return {
        "status": "ok",
        "service": "sightwhale-unified",
        "mode": "inmemory",
        "background_tasks": worker_count,
        "pipeline": pipeline_status,
        "last_alert_age_min": last_alert_age_min,
        "stale_workers": stale_workers,
        "worker_beats": worker_beats,
    }


# ── Phase 2: Telegram Bot routes (must precede mounts) ─────

from services.telegram_bot.api import (
    admin_diag_config,
    admin_diag_subscribers,
    debug_build,
    health as tg_health,
    test_alert,
)
from shared.auth import require_admin as _require_admin
from fastapi import Header, Query


@app.get("/telegram/health")
async def telegram_health():
    """Health check for the Telegram bot subsystem."""
    redis_ok = app.state.memory_redis is not None
    return {"status": "ok", "redis": "memory" if redis_ok else "unavailable"}


@app.get("/telegram/debug/build")
async def telegram_debug_build(x_admin_token: str | None = Header(None, alias="X-Admin-Token")):
    _require_admin(x_admin_token)
    keys = [
        "RENDER_GIT_COMMIT", "RENDER_SERVICE_ID", "RENDER_SERVICE_NAME",
        "RENDER_EXTERNAL_URL", "RENDER_INSTANCE_ID",
    ]
    env = {k: os.getenv(k) for k in keys if os.getenv(k)}
    admin_present = bool(getattr(settings, "admin_token", ""))
    return {
        "service": "sightwhale-unified",
        "env": env,
        "admin_debug": {"admin_token_present": admin_present},
    }


@app.get("/telegram/admin/diag/config")
async def telegram_admin_diag_config(x_admin_token: str | None = Header(None, alias="X-Admin-Token")):
    _require_admin(x_admin_token)
    import hashlib
    from datetime import datetime, timezone
    from sqlalchemy import func, select
    from shared.db import SessionLocal
    from shared.models import Delivery, Subscription

    redis = app.state.memory_redis
    q_len = await redis.llen(settings.alert_created_queue) if redis else 0

    now = datetime.now(timezone.utc)
    db_ok = True
    try:
        async with SessionLocal() as session:
            subs_total = int((await session.execute(
                select(func.count()).select_from(Subscription)
            )).scalar_one())
            subs_active = int((await session.execute(
                select(func.count())
                .select_from(Subscription)
                .where(Subscription.status.in_(["active", "trialing"]))
                .where(Subscription.current_period_end > now)
            )).scalar_one())
            deliveries = int((await session.execute(
                select(func.count()).select_from(Delivery)
            )).scalar_one())
    except Exception:
        db_ok = False
        subs_total = 0
        subs_active = 0
        deliveries = 0

    def _hash(v: str) -> str:
        return hashlib.sha1(f"admin:{v}".encode()).hexdigest()[:10]

    return {
        "service": "sightwhale-unified",
        "redis": {"type": "inmemory", "alert_created_queue_len": q_len},
        "db": {"ok": db_ok, "subscriptions_total": subs_total,
               "subscriptions_active_now": subs_active, "deliveries_total": deliveries},
        "telegram": {
            "bot_token_present": bool(settings.telegram_bot_token),
            "alert_chat_id_present": bool(settings.telegram_alert_chat_id),
        },
        "fanout_rate_limit_per_minute": settings.alert_fanout_rate_limit_per_minute,
    }


# ── Phase 2b: Register the admin/diagnostic handlers (F3) ──
# These already existed in services.telegram_bot.api but were imported as bare
# functions and never attached to a route (defect C) — so the operators had no
# supported way to verify a live Telegram delivery. Registering them here (still
# before the mounts) reuses the exact existing implementations, including their
# own _require_admin auth.
app.add_api_route(
    "/telegram/admin/diag/subscribers",
    admin_diag_subscribers,
    methods=["GET"],
    name="telegram_admin_diag_subscribers",
)
app.add_api_route(
    "/telegram/alerts/test",
    test_alert,
    methods=["POST"],
    name="telegram_test_alert",
)


@app.get("/telegram/admin/diag/deliveries")
async def telegram_admin_diag_deliveries(
    limit: int = Query(50, ge=1, le=200),
    x_admin_token: str | None = Header(None, alias="X-Admin-Token"),
):
    """Read-only delivery-ledger health (F3).

    Makes the previously blind alert→Telegram hop observable:
      * the most recent delivery rows with their outcome (sent/failed/pending);
      * a per-status count over the last 7 days;
      * per-subscriber reachability — Telegram refuses to let a bot message a
        user who never pressed /start, so a subscriber absent from `tg_users`
        fails delivery deterministically (403 "can't initiate conversation").

    Auth is fail-closed via _require_admin; the bot token (or any prefix of it)
    is never part of the response.
    """
    _require_admin(x_admin_token)

    from datetime import datetime, timedelta, timezone
    from sqlalchemy import func, select, text
    from shared.db import SessionLocal
    from shared.models import Delivery, Subscription, TgUser

    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    recent: list[dict] = []
    status_counts: dict[str, int] = {}
    subscribers: list[dict] = []
    db_ok = True
    try:
        async with SessionLocal() as session:
            rows = (await session.execute(
                select(
                    Delivery.telegram_id,
                    Delivery.whale_trade_id,
                    Delivery.status,
                    Delivery.error,
                    Delivery.updated_at,
                )
                .order_by(Delivery.id.desc())
                .limit(int(limit))
            )).all()
            recent = [
                {
                    "telegram_id": str(r[0]),
                    "whale_trade_id": str(r[1]),
                    "status": r[2],
                    "error": r[3],
                    "updated_at": r[4].isoformat() if r[4] else None,
                }
                for r in rows
            ]

            cnt_rows = (await session.execute(
                select(Delivery.status, func.count())
                .where(Delivery.delivered_at >= seven_days_ago)
                .group_by(Delivery.status)
            )).all()
            status_counts = {str(r[0]): int(r[1]) for r in cnt_rows}

            has_tg_users = bool(
                (await session.execute(
                    text("select to_regclass('public.tg_users')")
                )).scalar_one_or_none()
            )
            session_tids = set()
            if has_tg_users:
                session_tids = set(
                    str(t) for t in (await session.execute(
                        select(TgUser.telegram_id)
                    )).scalars().all()
                )
            sub_rows = (await session.execute(
                select(
                    Subscription.telegram_id,
                    Subscription.plan,
                    Subscription.status,
                    Subscription.current_period_end,
                )
                .order_by(Subscription.telegram_id)
            )).all()
            for s_tid, s_plan, s_status, period_end in sub_rows:
                sid = str(s_tid)
                has_session = sid in session_tids
                subscribers.append({
                    "telegram_id": sid,
                    "plan": s_plan,
                    "status": s_status,
                    "current_period_end": period_end.isoformat() if period_end else None,
                    "expired": bool(period_end and period_end <= now),
                    "has_session": has_session,
                    "deliverable": has_session,
                    "note": None if has_session else "no_bot_session_403",
                })
    except Exception:
        db_ok = False

    return {
        "service": "sightwhale-unified",
        "db_ok": db_ok,
        "window_days": 7,
        "recent": recent,
        "status_counts_7d": status_counts,
        "subscribers": subscribers,
    }


# ── Phase 3: Specific-prefix mounts ────────────────────────
# Must come before the wildcard "/" mount.

from services.whale_engine.api import app as whale_app
from services.alert_engine.api import app as alert_app
from services.payment.api import app as payment_app

app.mount("/whale", whale_app)    # /whale/health, /whale/whales/*, /whale/vw/*
app.mount("/alert", alert_app)    # /alert/health, /alert/alerts/*
app.mount("/payment", payment_app) # /payment/healthz, /payment/checkout, /payment/webhook


# ── Phase 4: Catch-all mount for trade_ingest routes ───────
# LAST — catches everything not matched above.
# Trade routes: /blog/*, /ingest/trade, /stats/*, /history, /market/*

from services.trade_ingest.api import app as trade_app
app.mount("/", trade_app)
