import hashlib
import json
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from urllib.parse import urlparse

from shared.config import settings
from shared.db import get_session
from shared.logging import configure_logging
from shared.models import Alert, Market


configure_logging(settings.log_level)

app = FastAPI(title="alert-engine")


def _redact_netloc(url: str) -> str:
  try:
    u = urlparse(url)
    if not u.netloc:
      return ""
    if "@" in u.netloc:
      return u.netloc.split("@", 1)[1]
    return u.netloc
  except Exception:
    return ""


def _require_admin(x_admin_token: str | None) -> None:
  if not settings.admin_token or not x_admin_token or x_admin_token != settings.admin_token:
    raise HTTPException(status_code=404, detail="not_found")


def _hash_admin(value: str) -> str:
  return hashlib.sha1(f"admin:{value}".encode("utf-8")).hexdigest()[:10]


@app.get("/health")
async def health():
  return {"status": "ok"}


@app.get("/alerts")
async def list_alerts(limit: int = Query(100, ge=1, le=1000), session: AsyncSession = Depends(get_session)):
  rows = (await session.execute(select(Alert).order_by(Alert.created_at.desc()).limit(limit))).scalars().all()
  return [
    {
      "id": a.id,
      "whale_trade_id": a.whale_trade_id,
      "market_id": a.market_id,
      "wallet_address": a.wallet_address,
      "whale_score": a.whale_score,
      "alert_type": a.alert_type,
      "created_at": a.created_at,
    }
    for a in rows
  ]


@app.get("/alerts/recent")
async def recent_alerts(minutes: int = Query(60, ge=1, le=1440), session: AsyncSession = Depends(get_session)):
  since = datetime.now(timezone.utc) - timedelta(minutes=minutes)
  rows = (await session.execute(select(Alert).where(Alert.created_at >= since).order_by(Alert.created_at.desc()))).scalars().all()
  return [
    {
      "id": a.id,
      "whale_trade_id": a.whale_trade_id,
      "market_id": a.market_id,
      "wallet_address": a.wallet_address,
      "whale_score": a.whale_score,
      "alert_type": a.alert_type,
      "created_at": a.created_at,
    }
    for a in rows
  ]


@app.get("/debug/queues")
async def debug_queues():
  names = [settings.trade_created_queue, settings.whale_trade_created_queue, settings.alert_created_queue]
  redis = Redis.from_url(settings.redis_url, decode_responses=True)
  try:
    queues = []
    for name in names:
      size = await redis.llen(name)
      last = await redis.lrange(name, -1, -1)
      queues.append({"name": name, "len": size, "last": last[0] if last else None})
    return {"queues": queues}
  finally:
    await redis.aclose()


@app.get("/admin/diag/config")
async def admin_diag_config(x_admin_token: str | None = Header(None, alias="X-Admin-Token")):
  _require_admin(x_admin_token)

  redis = Redis.from_url(settings.redis_url, decode_responses=True)
  try:
    await redis.ping()
    names = [settings.trade_created_queue, settings.whale_trade_created_queue, settings.alert_created_queue]
    queues = []
    for name in names:
      size = await redis.llen(name)
      last = await redis.lrange(name, -1, -1)
      queues.append({"name": name, "len": int(size), "last_preview": (last[0] or "")[:200] if last else None})
  finally:
    await redis.aclose()

  bot_token_present = bool(settings.telegram_bot_token)
  chat_id_present = bool(settings.telegram_alert_chat_id)
  return {
    "service": "alert-engine",
    "redis": {"host": _redact_netloc(settings.redis_url), "queues": queues},
    "rules": {
      "alert_cooldown_seconds": int(settings.alert_cooldown_seconds),
      "alert_min_score": int(settings.alert_min_score),
      "alert_min_trade_usd": float(settings.alert_min_trade_usd),
      "alert_always_score": int(settings.alert_always_score),
    },
    "telegram": {
      "bot_token_present": bot_token_present,
      "bot_token_hash": _hash_admin(settings.telegram_bot_token) if bot_token_present else None,
      "alert_chat_id_present": chat_id_present,
      "alert_chat_id_hash": _hash_admin(settings.telegram_alert_chat_id) if chat_id_present else None,
    },
  }


@app.post("/alerts/force")
async def force_alert(
  market_question: str = Query("Test Market Alert"),
  side: str = Query("buy"),
  size: float = Query(12345.67),
  price: float = Query(0.42),
  whale_score: int = Query(90),
  session: AsyncSession = Depends(get_session),
):
  now = datetime.now(timezone.utc)
  seed = f"{market_question}:{now.isoformat()}"
  whale_trade_id = hashlib.sha1(f"wt:{seed}".encode("utf-8")).hexdigest()[:32]
  alert_id = hashlib.sha1(f"al:{seed}".encode("utf-8")).hexdigest()[:32]
  market_id = hashlib.sha1(f"mk:{market_question}".encode("utf-8")).hexdigest()[:32]

  await session.execute(
    insert(Alert)
    .values(
      id=alert_id,
      whale_trade_id=whale_trade_id,
      market_id=market_id,
      wallet_address="0xabc1234567890defabc1234567890defabc12345",
      whale_score=whale_score,
      alert_type="test",
      created_at=now,
    )
    .on_conflict_do_nothing(index_elements=[Alert.whale_trade_id])
  )
  await session.commit()

  payload = {
    "alert_id": alert_id,
    "whale_trade_id": whale_trade_id,
    "market_id": market_id,
    "wallet_address": "0xabc1234567890defabc1234567890defabc12345",
    "whale_score": whale_score,
    "alert_type": "test",
    "market_question": market_question,
    "side": side,
    "size": size,
    "price": price,
    "created_at": now.isoformat(),
  }
  redis = Redis.from_url(settings.redis_url, decode_responses=True)
  try:
    await redis.rpush(settings.alert_created_queue, json.dumps(payload))
  finally:
    await redis.aclose()

  direct = {"ok": False}
  if settings.telegram_bot_token and settings.telegram_alert_chat_id:
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    text = (
      "Forced Alert Test\n\n"
      f"Market:\n{market_question}\n\n"
      f"Side:\n{side}\n\n"
      f"Size:\n${size}\n\n"
      f"Price:\n{price}\n\n"
      f"Whale Score:\n{whale_score}\n\n"
      f"Alert ID:\n{alert_id}"
    )
    async with httpx.AsyncClient() as client:
      resp = await client.post(
        url,
        json={"chat_id": settings.telegram_alert_chat_id, "text": text, "disable_web_page_preview": True},
        timeout=10,
      )
    if 200 <= resp.status_code < 300:
      direct = {"ok": True}
    else:
      direct = {"ok": False, "status": resp.status_code, "body": resp.text[:200]}

  return {"ok": True, "alert_id": alert_id, "whale_trade_id": whale_trade_id, "direct": direct}


@app.get("/markets/title")
async def market_title(id: str, session: AsyncSession = Depends(get_session)):
  row = (await session.execute(select(Market).where(Market.id == id))).scalars().first()
  if not row:
    return {"ok": False, "id": id, "title": None}
  return {"ok": True, "id": id, "title": row.title}
