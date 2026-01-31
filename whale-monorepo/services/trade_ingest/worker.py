import asyncio
import json
import logging
import os
import ssl
import time
from datetime import datetime, timezone

from celery import Celery
import httpx
from redis.asyncio import Redis
from sqlalchemy import select

from services.trade_ingest.markets import ingest_markets
from services.trade_ingest.polymarket import ingest_trades
from shared.config import settings
from shared.db import SessionLocal
from shared.logging import configure_logging
from shared.models import Alert, WhaleTrade


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
  "ingest-markets": {"task": "services.trade_ingest.ingest_markets", "schedule": 120.0},
  "ingest-trades": {"task": "services.trade_ingest.ingest_trades", "schedule": 30.0},
  "full-health-check": {"task": "services.trade_ingest.health_check", "schedule": 3600.0},
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


async def _fetch_health(client: httpx.AsyncClient, base_url: str) -> tuple[int | None, str]:
  url = base_url.rstrip("/") + "/health"
  try:
    resp = await client.get(url, timeout=10)
    return resp.status_code, ""
  except Exception as e:
    return None, str(e)


async def _inject_trade(client: httpx.AsyncClient, base_url: str, trade_id: str) -> tuple[bool, str]:
  url = base_url.rstrip("/") + "/ingest/trade"
  payload = {
    "trade_id": trade_id,
    "market_id": "health-market",
    "market_title": "Health Market",
    "wallet": "0xabc1234567890defabc1234567890defabc12345",
    "side": "buy",
    "amount": 40000,
    "price": 0.3,
    "timestamp": datetime.now(timezone.utc).isoformat(),
  }
  try:
    resp = await client.post(url, json=payload, timeout=10)
    if resp.status_code >= 200 and resp.status_code < 300:
      return True, ""
    return False, f"status={resp.status_code} body={resp.text[:200]}"
  except Exception as e:
    return False, str(e)


async def _wait_for_alert(trade_id: str, started_at: datetime, timeout_seconds: int = 120) -> tuple[str | None, str | None]:
  deadline = time.monotonic() + timeout_seconds
  while time.monotonic() < deadline:
    async with SessionLocal() as session:
      wt = (
        await session.execute(
          select(WhaleTrade).where(WhaleTrade.trade_id == trade_id)
        )
      ).scalars().first()
      if not wt:
        await asyncio.sleep(5)
        continue
      alert = (
        await session.execute(
          select(Alert).where(Alert.whale_trade_id == wt.id).where(Alert.created_at >= started_at)
        )
      ).scalars().first()
      if alert:
        return wt.id, alert.id
    await asyncio.sleep(5)
  return None, None


async def _resolve_chat_id(client: httpx.AsyncClient) -> str | None:
  if settings.telegram_health_chat_id:
    return settings.telegram_health_chat_id
  username = (settings.telegram_health_username or "").lstrip("@")
  if not settings.telegram_health_bot_token or not username:
    return None
  base = f"https://api.telegram.org/bot{settings.telegram_health_bot_token}"
  chat_resp = await client.get(f"{base}/getChat", params={"chat_id": f"@{username}"}, timeout=10)
  if chat_resp.status_code == 200:
    payload = chat_resp.json()
    if payload.get("ok") and payload.get("result", {}).get("id"):
      return str(payload["result"]["id"])
  updates_resp = await client.get(f"{base}/getUpdates", timeout=10)
  if updates_resp.status_code != 200:
    return None
  data = updates_resp.json()
  if not data.get("ok"):
    return None
  for item in data.get("result", []):
    msg = item.get("message") or item.get("edited_message") or {}
    chat = msg.get("chat") or {}
    from_user = msg.get("from") or {}
    if (chat.get("username") or "").lower() == username.lower():
      return str(chat.get("id"))
    if (from_user.get("username") or "").lower() == username.lower():
      return str(chat.get("id"))
  return None


async def _send_telegram(client: httpx.AsyncClient, content: str) -> None:
  if not settings.telegram_health_bot_token:
    logger.warning("telegram_health_bot_token_missing")
    return
  chat_id = await _resolve_chat_id(client)
  if not chat_id:
    logger.warning("telegram_health_chat_id_missing")
    return
  url = f"https://api.telegram.org/bot{settings.telegram_health_bot_token}/sendMessage"
  payload = {"chat_id": chat_id, "text": content, "disable_web_page_preview": True}
  resp = await client.post(url, json=payload, timeout=10)
  if resp.status_code < 200 or resp.status_code >= 300:
    logger.warning("telegram_send_failed status=%s body=%s", resp.status_code, resp.text[:200])


async def run_full_health_check() -> dict:
  proxies = settings.https_proxy or None
  health_urls = {
    "trade_ingest": settings.health_trade_ingest_api_url,
    "whale_engine": settings.health_whale_engine_api_url,
    "alert_engine": settings.health_alert_engine_api_url,
    "payment": settings.health_payment_api_url,
  }
  started_at = datetime.now(timezone.utc)
  trade_id = f"health-test-{int(time.time())}"
  results: dict[str, str] = {}

  async with httpx.AsyncClient(proxies=proxies) as client:
    for name, base_url in health_urls.items():
      code, err = await _fetch_health(client, base_url)
      if code is None:
        results[name] = f"error:{err}"
      else:
        results[name] = str(code)

    injected, inject_err = await _inject_trade(client, health_urls["trade_ingest"], trade_id)
    results["inject_trade"] = "ok" if injected else f"error:{inject_err}"

    whale_trade_id, alert_id = await _wait_for_alert(trade_id, started_at)
    results["whale_trade"] = whale_trade_id or "timeout"
    results["alert"] = alert_id or "timeout"

    ok = all(v == "200" for k, v in results.items() if k in {"trade_ingest", "whale_engine", "alert_engine", "payment"}) and injected and alert_id
    status = "OK" if ok else "FAIL"
    lines = [
      f"全链路检查结果: {status}",
      f"时间(UTC): {started_at.isoformat()}",
      f"trade-ingest /health: {results['trade_ingest']}",
      f"whale-engine /health: {results['whale_engine']}",
      f"alert-engine /health: {results['alert_engine']}",
      f"payment /health: {results['payment']}",
      f"注入测试交易: {results['inject_trade']}",
      f"WhaleTrade: {results['whale_trade']}",
      f"Alert: {results['alert']}",
    ]
    await _send_telegram(client, "\n".join(lines))

  return {"status": status, "trade_id": trade_id, "results": results}


@celery_app.task(name="services.trade_ingest.ingest_markets")
def ingest_markets_task() -> int:
  async def runner():
    async with SessionLocal() as session:
      n = await ingest_markets(session)
      await session.commit()
    return n

  return _run(runner())


@celery_app.task(name="services.trade_ingest.ingest_trades")
def ingest_trades_task() -> int:
  async def runner():
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    try:
      async with SessionLocal() as session:
        trade_ids = await ingest_trades(session)
        await session.commit()
      
      if trade_ids:
        await redis.rpush(settings.trade_created_queue, *[json.dumps({"trade_id": tid}) for tid in trade_ids])
      return len(trade_ids)
    finally:
      await redis.aclose()

  try:
    return _run(runner())
  except Exception:
    logger.exception("ingest_trades_failed")
    return 0


@celery_app.task(name="services.trade_ingest.health_check")
def health_check_task() -> dict:
  return _run(run_full_health_check())
