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


def _run(coro):
  try:
    loop = asyncio.get_event_loop()
  except RuntimeError:
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
  if loop.is_closed():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
  return loop.run_until_complete(coro)


async def _consume_once() -> int:
  redis = Redis.from_url(settings.redis_url, decode_responses=True)
  try:
    batch_size = int(os.getenv("TRADE_CONSUME_BATCH", "50"))
    item = await redis.blpop(settings.trade_created_queue, timeout=1)
    if not item:
      return 0
    _, raw = item
    raws = [raw]
    for _ in range(batch_size - 1):
      nxt = await redis.lpop(settings.trade_created_queue)
      if not nxt:
        break
      raws.append(nxt)
    created_count = 0
    async with SessionLocal() as session:
      for payload in raws:
        msg = json.loads(payload)
        trade_id = str(msg.get("trade_id") or "")
        if not trade_id:
          continue
        created = await process_trade_id(session, redis, trade_id)
        if created:
          created_count += 1
        await session.commit()
    return created_count
  finally:
    await redis.aclose()


@celery_app.task(name="services.whale_engine.consume_trade_created")
def consume_trade_created() -> int:
  return _run(_consume_once())
