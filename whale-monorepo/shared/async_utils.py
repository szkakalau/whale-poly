"""Shared async utilities for Celery workers: persistent event loop, Redis pool, and Lua scripts."""

import asyncio
import os

from redis.asyncio import Redis

from shared.config import settings

# ── Persistent event loop ──────────────────────────────────

_LOOP: asyncio.AbstractEventLoop | None = None


def get_or_create_event_loop() -> asyncio.AbstractEventLoop:
    """Return a persistent event loop, creating one if closed or not yet created.

    Avoids leaking event loops on every Celery task invocation (CR-C5).
    """
    global _LOOP
    if _LOOP is None or _LOOP.is_closed():
        _LOOP = asyncio.new_event_loop()
        asyncio.set_event_loop(_LOOP)
    return _LOOP


def run_async(coro):
    """Run a coroutine on the persistent event loop."""
    return get_or_create_event_loop().run_until_complete(coro)


# ── Redis connection pool ──────────────────────────────────

_redis: Redis | None = None


async def get_redis() -> Redis:
    """Return a module-level Redis connection, creating one if not yet created.

    Reused across Celery task invocations / API requests instead of creating
    a new TCP connection each time (PF-H2).

    When REDIS_URL is empty, returns an InMemoryRedis instance for single-process
    operation without an external Redis dependency.
    """
    global _redis
    if _redis is None:
        if settings.redis_url:
            _redis = Redis.from_url(settings.redis_url, decode_responses=True)
        else:
            from services.unified.memory_store import InMemoryRedis
            import logging
            logging.getLogger("shared.async_utils").info("redis_url_empty — using InMemoryRedis")
            _redis = InMemoryRedis(decode_responses=True)  # type: ignore[assignment]
    return _redis


# ── Lua scripts ────────────────────────────────────────────

BATCH_RPUSH_SCRIPT = """
for i = 1, #ARGV do
    redis.call('RPUSH', KEYS[1], ARGV[i])
end
return #ARGV
"""
# Atomic batch RPUSH — avoids the unpack-size risk of
# `redis.rpush(key, *large_list)` (CR-I4).
