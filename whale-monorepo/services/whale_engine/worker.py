import asyncio
import json
import logging
import os
import ssl

from celery import Celery
from redis.asyncio import Redis

from services.whale_engine.engine import process_trade_id
from shared.config import settings
from shared.db import SessionLocal
from shared.logging import configure_logging


configure_logging(settings.log_level)
logger = logging.getLogger("whale_engine.worker")


celery_app = Celery("whale_engine", broker=settings.redis_url, backend=settings.redis_url)
if settings.redis_url.startswith("rediss://"):
  celery_app.conf.broker_use_ssl = {"ssl_cert_reqs": ssl.CERT_REQUIRED}
  celery_app.conf.redis_backend_use_ssl = {"ssl_cert_reqs": ssl.CERT_REQUIRED}
celery_app.conf.worker_concurrency = int(os.getenv("CELERY_CONCURRENCY", "1"))
celery_app.conf.worker_pool = os.getenv("CELERY_POOL", "solo")
celery_app.conf.timezone = "UTC"
celery_app.conf.task_default_queue = "whale_engine"
celery_app.conf.task_default_exchange = "whale_engine"
celery_app.conf.task_default_routing_key = "whale_engine"
celery_app.conf.beat_schedule = {
  "consume-trade-created": {"task": "services.whale_engine.consume_trade_created", "schedule": 1.0}
}


async def _consume_once() -> int:
  redis = Redis.from_url(settings.redis_url, decode_responses=True)
  try:
    item = await redis.blpop(settings.trade_created_queue, timeout=1)
    if not item:
      return 0
    _, raw = item
    msg = json.loads(raw)
    trade_id = str(msg.get("trade_id") or "")
    if not trade_id:
      return 0
    async with SessionLocal() as session:
      created = await process_trade_id(session, redis, trade_id)
      await session.commit()
    return 1 if created else 0
  finally:
    await redis.aclose()


@celery_app.task(name="services.whale_engine.consume_trade_created")
def consume_trade_created() -> int:
  return asyncio.run(_consume_once())
