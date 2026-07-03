import asyncio
import json
import logging
import os
import ssl

from celery import Celery
from redis.asyncio import Redis

from services.alert_engine.engine import process_whale_trade_event
from shared.async_utils import get_or_create_event_loop, get_redis, run_async
from shared.config import settings
from shared.db import SessionLocal
from shared.logging import configure_logging


configure_logging(settings.log_level)
logger = logging.getLogger("alert_engine.worker")


celery_app = Celery("alert_engine", broker=settings.redis_url, backend=settings.redis_url)
if settings.redis_url.startswith("rediss://"):
  celery_app.conf.broker_use_ssl = {"ssl_cert_reqs": ssl.CERT_REQUIRED}
  celery_app.conf.redis_backend_use_ssl = {"ssl_cert_reqs": ssl.CERT_REQUIRED}
celery_app.conf.worker_concurrency = int(os.getenv("CELERY_CONCURRENCY", "1"))
celery_app.conf.worker_pool = os.getenv("CELERY_POOL", "solo")
celery_app.conf.timezone = "UTC"
celery_app.conf.task_default_queue = "alert_engine"
celery_app.conf.task_default_exchange = "alert_engine"
celery_app.conf.task_default_routing_key = "alert_engine"
celery_app.conf.beat_schedule = {
  "consume-whale-trade-created": {"task": "services.alert_engine.consume_whale_trade_created", "schedule": 1.0}
}


async def _consume_once() -> int:
  """Batch-consume whale trade events from Redis (PF-H6).
  BLPOP first item, then LPOP up to alert_consume_batch_size more,
  and process all in a single DB transaction."""
  redis = await get_redis()
  item = await redis.blpop(settings.whale_trade_created_queue, timeout=1)
  if not item:
    return 0
  _, raw = item
  raws = [raw]

  # Drain remaining items from the queue (up to batch size).
  batch_size = int(os.getenv("ALERT_CONSUME_BATCH_SIZE", str(settings.alert_consume_batch_size)))
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
        logger.exception("alert_consume_failed")
    await session.commit()
  return created_count


@celery_app.task(name="services.alert_engine.consume_whale_trade_created", autoretry_for=(Exception,), retry_backoff=True, retry_backoff_max=60, max_retries=3, retry_jitter=True)
def consume_whale_trade_created() -> int:
  try:
    return run_async(_consume_once())
  except Exception:
    logger.exception("consume_failed")
    return 0
