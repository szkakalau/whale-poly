import asyncio
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import httpx
from fastapi import FastAPI, Query
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from services.telegram_bot.bot import build_application
from services.telegram_bot.templates import format_alert
from services.telegram_bot.rate_limit import allow_send
from shared.config import settings
from shared.db import SessionLocal
from shared.logging import configure_logging
from shared.models import Delivery, Subscription


configure_logging(settings.log_level)
logger = logging.getLogger("telegram_bot.api")


async def consume_alerts_forever(stop: asyncio.Event, redis: Redis, application) -> None:
  while not stop.is_set():
    item = await redis.blpop(settings.alert_created_queue, timeout=1)
    if not item:
      continue
    _, raw = item
    try:
      payload = json.loads(raw)
    except Exception:
      continue

    whale_trade_id = str(payload.get("whale_trade_id") or "")
    if not whale_trade_id:
      continue

    now = datetime.now(timezone.utc)
    async with SessionLocal() as session:
      telegram_ids = (
        await session.execute(
          select(Subscription.telegram_id)
          .where(Subscription.status == "active")
          .where(Subscription.current_period_end > now)
        )
      ).scalars().all()
      if settings.telegram_alert_chat_id:
        telegram_ids = list(dict.fromkeys([*telegram_ids, settings.telegram_alert_chat_id]))

      for tid in telegram_ids:
        if not await allow_send(redis, tid, settings.alert_fanout_rate_limit_per_minute):
          await redis.rpush(settings.alert_created_queue, raw)
          break
        result = await session.execute(
          insert(Delivery)
          .values(telegram_id=tid, whale_trade_id=whale_trade_id)
          .on_conflict_do_nothing(index_elements=["telegram_id", "whale_trade_id"])
        )
        if result.rowcount != 1:
          continue
        await application.bot.send_message(chat_id=int(tid), text=format_alert(payload, tid), disable_web_page_preview=True)

      await session.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
  stop = asyncio.Event()
  redis = Redis.from_url(settings.redis_url, decode_responses=True)
  await redis.ping()
  tasks: list[asyncio.Task] = []
  if not settings.telegram_bot_token:
    logger.warning("telegram_bot_token_missing")
    try:
      yield
    finally:
      await redis.aclose()
    return

  application = await build_application()

  # Only consume alerts, no polling to avoid conflicts
  tasks = [
    asyncio.create_task(consume_alerts_forever(stop, redis, application), name="alert_consumer"),
  ]
  try:
    yield
  finally:
    stop.set()
    for t in tasks:
      t.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
    await redis.aclose()


app = FastAPI(title="telegram-bot", lifespan=lifespan)


@app.get("/health")
async def health():
  return {"status": "ok"}


@app.post("/alerts/test")
async def test_alert(message: str = Query("Test alert from SightWhale")):
  if not settings.telegram_bot_token or not settings.telegram_alert_chat_id:
    return {"ok": False, "error": "telegram_alert_config_missing"}
  url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
  payload = {
    "chat_id": settings.telegram_alert_chat_id,
    "text": message,
    "disable_web_page_preview": True,
  }
  async with httpx.AsyncClient() as client:
    resp = await client.post(url, json=payload, timeout=10)
  if resp.status_code < 200 or resp.status_code >= 300:
    return {"ok": False, "status": resp.status_code, "body": resp.text[:200]}
  return {"ok": True}