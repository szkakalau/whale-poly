import asyncio
import json
import logging
import os
import ssl

from celery import Celery
from redis.asyncio import Redis

from services.whale_engine.engine import process_trade_id, recompute_whale_stats
from services.whale_engine.vw import compute_vw_metrics, prune_vw_snapshots
from shared.config import get_alert_config, settings
from shared.db import SessionLocal
from shared.logging import configure_logging


from celery.utils.log import get_task_logger

configure_logging(settings.log_level)
logger = get_task_logger(__name__)
logger.info(f"DEBUG: Worker configured to listen on queue: {settings.trade_created_queue}")


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
consume_seconds = float(os.getenv("WHALE_CONSUME_SECONDS", "1"))
recompute_seconds = float(os.getenv("WHALE_RECOMPUTE_SECONDS", "900"))
celery_app.conf.beat_schedule = {
  "consume-trade-created": {"task": "services.whale_engine.consume_trade_created", "schedule": consume_seconds},
  "recompute-whale-stats": {"task": "services.whale_engine.recompute_whale_stats", "schedule": recompute_seconds},
  "compute-vw-metrics": {"task": "services.whale_engine.compute_vw_metrics", "schedule": 300.0},
  "prune-vw-snapshots": {"task": "services.whale_engine.prune_vw_snapshots", "schedule": 21600.0},
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
  logger.info(f"DEBUG: _consume_once started, redis={settings.redis_url}, queue={settings.trade_created_queue}")
  redis = Redis.from_url(settings.redis_url, decode_responses=True)
  redis_ping_result = await redis.ping()
  logger.info(f"DEBUG: Redis connection ping result: {redis_ping_result}")
  logger.info(f"DEBUG: Worker blpop from queue: {settings.trade_created_queue}")
  try:
    batch_size = int(os.getenv("TRADE_CONSUME_BATCH", "50"))
    item = await redis.blpop(settings.trade_created_queue, timeout=1)
    logger.info(f"DEBUG: blpop result: {item}")
    if not item:
      return 0
    _, raw = item
    logger.info(f"DEBUG: popped item: {raw}")
    raws = [raw]
    for _ in range(batch_size - 1):
      nxt = await redis.lpop(settings.trade_created_queue)
      if not nxt:
        break
      raws.append(nxt)
    
    created_count = 0
    async with SessionLocal() as session:
      for payload in raws:
        logger.info(f"DEBUG: processing payload: {payload}")
        try:
          msg = json.loads(payload)
          trade_id = str(msg.get("trade_id") or "")
          logger.info(f"DEBUG: extracted trade_id: {trade_id}")
          if not trade_id:
            continue
          created = await process_trade_id(session, redis, trade_id)
          if created:
            created_count += 1
        except Exception:
          logger.exception(f"failed_to_process_trade payload={payload}")
      await session.commit()
    
    if len(raws) > 0:
      logger.info(f"consumed_trades count={len(raws)} created_whales={created_count}")
    return created_count
  finally:
    await redis.aclose()


@celery_app.task(name="services.whale_engine.consume_trade_created")
def consume_trade_created() -> int:
  return _run(_consume_once())


async def _recompute_stats_once() -> int:
  async with SessionLocal() as session:
    n = await recompute_whale_stats(session)
    await session.commit()
  return int(n)


@celery_app.task(name="services.whale_engine.recompute_whale_stats")
def recompute_whale_stats_task() -> int:
  try:
    return _run(_recompute_stats_once())
  except Exception:
    logger.exception("recompute_whale_stats_failed")
    return 0


async def _compute_vw_once() -> int:
  """执行一轮 VW 指标计算"""
  config = get_alert_config().get("vw_analysis", {})
  redis = Redis.from_url(settings.redis_url, decode_responses=True)
  try:
    async with SessionLocal() as session:
      n = await compute_vw_metrics(session, redis, config)
      await session.commit()
    return n
  finally:
    await redis.aclose()


@celery_app.task(name="services.whale_engine.compute_vw_metrics")
def compute_vw_metrics_task() -> int:
  try:
    return _run(_compute_vw_once())
  except Exception:
    logger.exception("compute_vw_metrics_failed")
    return 0


async def _prune_vw_once() -> int:
  """执行一轮 VW 快照清理"""
  config = get_alert_config().get("vw_analysis", {})
  async with SessionLocal() as session:
    n = await prune_vw_snapshots(session, config)
    await session.commit()
  return n


@celery_app.task(name="services.whale_engine.prune_vw_snapshots")
def prune_vw_snapshots_task() -> int:
  try:
    return _run(_prune_vw_once())
  except Exception:
    logger.exception("prune_vw_snapshots_failed")
    return 0
