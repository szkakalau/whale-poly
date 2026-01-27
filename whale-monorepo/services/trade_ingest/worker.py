import asyncio
import logging
import os
import ssl

from celery import Celery
from redis.asyncio import Redis

from services.trade_ingest.markets import ingest_markets
from services.trade_ingest.polymarket import ingest_trades
from shared.config import settings
from shared.db import SessionLocal
from shared.logging import configure_logging


configure_logging(settings.log_level)
logger = logging.getLogger("trade_ingest.worker")


celery_app = Celery("trade_ingest", broker=settings.redis_url, backend=settings.redis_url)
if settings.redis_url.startswith("rediss://"):
  celery_app.conf.broker_use_ssl = {"ssl_cert_reqs": ssl.CERT_REQUIRED}
  celery_app.conf.redis_backend_use_ssl = {"ssl_cert_reqs": ssl.CERT_REQUIRED}
celery_app.conf.worker_concurrency = int(os.getenv("CELERY_CONCURRENCY", "1"))
celery_app.conf.worker_pool = os.getenv("CELERY_POOL", "solo")
celery_app.conf.timezone = "UTC"
celery_app.conf.task_default_queue = "trade_ingest"
celery_app.conf.task_default_exchange = "trade_ingest"
celery_app.conf.task_default_routing_key = "trade_ingest"
celery_app.conf.beat_schedule = {
  "ingest-markets": {"task": "services.trade_ingest.ingest_markets", "schedule": 600.0},
  "ingest-trades": {"task": "services.trade_ingest.ingest_trades", "schedule": 30.0},
}


@celery_app.task(name="services.trade_ingest.ingest_markets")
def ingest_markets_task() -> int:
  async def runner():
    async with SessionLocal() as session:
      n = await ingest_markets(session)
      await session.commit()
    return n

  return asyncio.run(runner())


@celery_app.task(name="services.trade_ingest.ingest_trades")
def ingest_trades_task() -> int:
  async def runner():
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    try:
      async with SessionLocal() as session:
        n = await ingest_trades(session, redis)
        await session.commit()
      return n
    finally:
      await redis.aclose()

  try:
    return asyncio.run(runner())
  except Exception:
    logger.exception("ingest_trades_failed")
    return 0
