import asyncio
import json
import logging

from celery import Celery
from redis.asyncio import Redis

from services.alert_engine.engine import process_whale_trade_event
from shared.config import settings
from shared.db import SessionLocal
from shared.logging import configure_logging


configure_logging(settings.log_level)
logger = logging.getLogger("alert_engine.worker")


celery_app = Celery("alert_engine", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.timezone = "UTC"
celery_app.conf.beat_schedule = {
  "consume-whale-trade-created": {"task": "services.alert_engine.consume_whale_trade_created", "schedule": 1.0}
}


async def _consume_once() -> int:
  redis = Redis.from_url(settings.redis_url, decode_responses=True)
  try:
    item = await redis.blpop(settings.whale_trade_created_queue, timeout=1)
    if not item:
      return 0
    _, raw = item
    event = json.loads(raw)
    async with SessionLocal() as session:
      created = await process_whale_trade_event(session, redis, event)
      await session.commit()
    return 1 if created else 0
  finally:
    await redis.aclose()


@celery_app.task(name="services.alert_engine.consume_whale_trade_created")
def consume_whale_trade_created() -> int:
  try:
    return asyncio.run(_consume_once())
  except Exception:
    logger.exception("consume_failed")
    return 0

