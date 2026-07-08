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
# Background task tracking for Telegram delayed sends
# ═══════════════════════════════════════════════════════════════

_pending_sends: set[asyncio.Task] = set()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init memory store, mount workers, init Telegram bot.
    Shutdown: cancel all background tasks gracefully.
    """
    global _pending_sends
    logger.info("unified_lifespan_startup")

    # ── Initialize InMemoryRedis ────────────────────────────
    from services.unified.memory_store import InMemoryRedis
    memory_redis = InMemoryRedis(decode_responses=True)

    # Patch shared.get_redis to return our instance
    import shared.async_utils as _async_utils
    _async_utils._redis = memory_redis  # type: ignore[attr-defined]
    logger.info("inmemory_redis_initialized")

    # ── Ensure blog_posts table exists ──────────────────────
    from shared.db import SessionLocal
    from sqlalchemy import text
    try:
        async with SessionLocal() as session:
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS blog_posts (
                    id text primary key, slug text not null, title text not null,
                    excerpt text not null, content text not null, author text not null,
                    read_time text not null, cover_image text, tags text[] default '{}',
                    published_at timestamptz not null, created_at timestamptz not null default now(),
                    updated_at timestamptz not null default now(),
                    language text not null default 'en', group_slug text,
                    status text not null default 'published'
                )
            """))
            try:
                await session.execute(text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_slug_language_idx ON blog_posts (slug, language)"
                ))
            except Exception:
                pass
            await session.commit()
    except Exception:
        logger.exception("blog_posts_table_init_failed")

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

        # Cancel pending Telegram delayed sends
        for t in list(_pending_sends):
            t.cancel()
        if _pending_sends:
            await asyncio.gather(*_pending_sends, return_exceptions=True)
            logger.info("pending_sends_cancelled count=%d", len(_pending_sends))

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
    worker_count = len([t for t in asyncio.all_tasks()
                        if hasattr(t, 'get_name') and not t.get_name().startswith('Task-')])
    return {
        "status": "ok",
        "service": "sightwhale-unified",
        "mode": "inmemory",
        "background_tasks": worker_count,
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
