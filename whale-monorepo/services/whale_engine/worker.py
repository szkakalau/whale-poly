import asyncio
import json
import logging
import os
import signal
import ssl
import threading

from celery import Celery
from celery.signals import worker_ready
from redis.asyncio import Redis

from services.whale_engine.engine import process_trade_id, recompute_whale_stats
from services.whale_engine.vw import compute_vw_metrics, prune_vw_snapshots
from shared.async_utils import BATCH_RPUSH_SCRIPT as _BATCH_RPUSH, get_or_create_event_loop, get_redis, run_async
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
celery_app.conf.beat_schedule = {
    "consume-trade-created": {"task": "services.whale_engine.consume_trade_created", "schedule": 1.0},
    "recompute-whale-stats": {"task": "services.whale_engine.recompute_whale_stats", "schedule": 300.0},
    "compute-vw-metrics": {"task": "services.whale_engine.compute_vw_metrics", "schedule": 3600.0},
    "prune-vw-snapshots": {"task": "services.whale_engine.prune_vw_snapshots", "schedule": 86400.0},
}

# ── Self-driven consumption loop (bypasses Celery Beat unreliability on Render) ──
# Beat scheduler in embedded mode (-B) can silently fail to dispatch tasks on
# Render's ephemeral filesystem.  worker_ready signal ensures consumption starts
# immediately and keeps running without any Beat dependency.

_consume_stop: threading.Event | None = None
_consume_thread: threading.Thread | None = None


def _run_consume_loop(stop: threading.Event) -> None:
    """Continuously consume from trade_created queue in a dedicated thread."""
    logger.info("consume_loop: starting continuous consumption")
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    backoff = 0.0
    while not stop.is_set():
        try:
            n = loop.run_until_complete(_consume_once())
            if n > 0:
                backoff = 0.0  # reset backoff after successful work
            elif backoff < 5.0:
                backoff = min(backoff + 0.1, 5.0)  # gradual backoff when idle
            if backoff > 0:
                stop.wait(backoff)
        except Exception:
            logger.exception("consume_loop: error in _consume_once")
            stop.wait(1.0)  # brief pause on error before retry
    loop.close()
    logger.info("consume_loop: stopped")


@worker_ready.connect
def _start_consume_loop(sender, **kwargs):
    """Start the self-driven consumption loop as soon as the worker is ready."""
    global _consume_stop, _consume_thread
    if _consume_thread is not None:
        return  # already running
    _consume_stop = threading.Event()
    _consume_thread = threading.Thread(target=_run_consume_loop, args=(_consume_stop,), daemon=True, name="consume-loop")
    _consume_thread.start()
    logger.info("worker_ready: started consume loop thread")


# Graceful shutdown — stop the consume loop on SIGTERM/SIGINT
def _stop_consume_loop(*_args):
    global _consume_stop
    if _consume_stop is not None:
        _consume_stop.set()

signal.signal(signal.SIGTERM, _stop_consume_loop)
signal.signal(signal.SIGINT, _stop_consume_loop)


async def _consume_once() -> int:
  logger.info(f"DEBUG: _consume_once started, redis={settings.redis_url}, queue={settings.trade_created_queue}")
  redis = await get_redis()
  logger.info(f"DEBUG: Worker blpop from queue: {settings.trade_created_queue}")
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
  # Collect event payloads so we can push them AFTER the DB commit (CR-C3).
  # Pushing before commit creates orphan queue messages if the transaction
  # rolls back — downstream services would process a trade that doesn't exist.
  events: list[dict] = []
  async with SessionLocal() as session:
    for payload in raws:
      logger.info(f"DEBUG: processing payload: {payload}")
      try:
        msg = json.loads(payload)
        trade_id = str(msg.get("trade_id") or "")
        logger.info(f"DEBUG: extracted trade_id: {trade_id}")
        if not trade_id:
          continue
        created, event = await process_trade_id(session, redis, trade_id)
        if created and event is not None:
          created_count += 1
          events.append(event)
      except Exception:
        logger.exception(f"failed_to_process_trade payload={payload}")
    await session.commit()

  # Push to Redis only AFTER the DB transaction committed successfully.
  if events:
    for i in range(0, len(events), 50):
      chunk = events[i:i + 50]
      chunk_raw = [json.dumps(e) for e in chunk]
      await redis.eval(_BATCH_RPUSH, 1, settings.whale_trade_created_queue, *chunk_raw)

  if len(raws) > 0:
    logger.info(f"consumed_trades count={len(raws)} created_whales={created_count}")
  return created_count


@celery_app.task(name="services.whale_engine.consume_trade_created", autoretry_for=(Exception,), retry_backoff=True, retry_backoff_max=60, max_retries=3, retry_jitter=True)
def consume_trade_created() -> int:
  try:
    return run_async(_consume_once())
  except Exception:
    logger.exception("consume_trade_created_failed")
    return 0


async def _recompute_stats_once() -> int:
  async with SessionLocal() as session:
    n = await recompute_whale_stats(session)
    await session.commit()
  return int(n)


@celery_app.task(name="services.whale_engine.recompute_whale_stats", autoretry_for=(Exception,), retry_backoff=True, retry_backoff_max=60, max_retries=3, retry_jitter=True)
def recompute_whale_stats_task() -> int:
  try:
    return run_async(_recompute_stats_once())
  except Exception:
    logger.exception("recompute_whale_stats_failed")
    return 0


async def _compute_vw_once() -> int:
  """执行一轮 VW 指标计算"""
  config = get_alert_config().get("vw_analysis", {})
  redis = await get_redis()
  async with SessionLocal() as session:
    n = await compute_vw_metrics(session, redis, config)
    await session.commit()
  return n


@celery_app.task(name="services.whale_engine.compute_vw_metrics", autoretry_for=(Exception,), retry_backoff=True, retry_backoff_max=60, max_retries=3, retry_jitter=True)
def compute_vw_metrics_task() -> int:
  try:
    return run_async(_compute_vw_once())
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


@celery_app.task(name="services.whale_engine.prune_vw_snapshots", autoretry_for=(Exception,), retry_backoff=True, retry_backoff_max=60, max_retries=3, retry_jitter=True)
def prune_vw_snapshots_task() -> int:
  try:
    return run_async(_prune_vw_once())
  except Exception:
    logger.exception("prune_vw_snapshots_failed")
    return 0
