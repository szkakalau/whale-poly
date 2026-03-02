import hashlib
import json
import os
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from urllib.parse import urlparse

from services.alert_engine.engine import _resolve_outcome_from_token
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

@app.get("/debug/build")
async def debug_build():
  keys = [
    "RENDER_GIT_COMMIT",
    "RENDER_SERVICE_ID",
    "RENDER_SERVICE_NAME",
    "RENDER_EXTERNAL_URL",
    "RENDER_INSTANCE_ID",
  ]
  env = {k: os.getenv(k) for k in keys if os.getenv(k)}
  return {"service": "alert-engine", "env": env}

@app.get("/debug/resolve_outcome")
async def debug_resolve_outcome(token_id: str = Query(..., min_length=1)):
  redis = Redis.from_url(settings.redis_url, decode_responses=True)
  try:
    resolved = await _resolve_outcome_from_token(redis, token_id)
    cached = await redis.get(f"token_outcome:{str(token_id).strip()}")
    return {"token_id": token_id, "outcome": resolved, "cache_value": cached}
  finally:
    await redis.aclose()

@app.get("/debug/outcome")
async def debug_outcome(token_id: str = Query(..., min_length=1)):
  tid = str(token_id).strip()
  proxy = settings.https_proxy or None
  result: dict = {"token_id": tid, "proxy_set": bool(proxy), "steps": []}
  condition_id: str | None = None
  async with httpx.AsyncClient(proxy=proxy) as client:
    for name, url, params in [
      ("gamma_tokens", "https://gamma-api.polymarket.com/tokens", {"tokenId": tid}),
      ("gamma_markets_by_clob", "https://gamma-api.polymarket.com/markets", {"clobTokenIds": tid}),
    ]:
      step: dict = {"name": name}
      try:
        resp = await client.get(url, params=params, timeout=10)
        step["status"] = resp.status_code
        if resp.status_code == 200:
          data = resp.json()
          first = data[0] if isinstance(data, list) and data else data
          if isinstance(first, dict):
            step["keys"] = sorted(list(first.keys()))[:40]
            market = first.get("market") if name == "gamma_tokens" else first
            if isinstance(market, dict):
              for k in ["clobTokenIds", "outcomes", "outcomeNames", "outcomeTokens", "tokens"]:
                if k in market:
                  v = market.get(k)
                  if isinstance(v, list):
                    step[f"{k}_len"] = len(v)
                  elif isinstance(v, str):
                    step[f"{k}_preview"] = v[:200]
          step["preview"] = resp.text[:200]
        else:
          step["preview"] = resp.text[:200]
      except Exception as e:
        step["error"] = repr(e)
      result["steps"].append(step)

    for name, url, params in [
      ("clob_ok", "https://clob.polymarket.com/ok", None),
      ("clob_book_token_id", "https://clob.polymarket.com/book", {"token_id": tid}),
      ("clob_book_tokenID", "https://clob.polymarket.com/book", {"tokenID": tid}),
      ("clob_orderbook_token_id", "https://clob.polymarket.com/orderbook", {"token_id": tid}),
      ("clob_price", "https://clob.polymarket.com/price", {"token_id": tid, "side": "buy"}),
    ]:
      step: dict = {"name": name}
      try:
        resp = await client.get(url, params=params, timeout=10)
        step["status"] = resp.status_code
        step["preview"] = resp.text[:200]
        if resp.status_code == 200:
          try:
            data = resp.json()
            if isinstance(data, dict):
              step["keys"] = sorted(list(data.keys()))[:40]
              if "market" in data:
                step["market"] = data.get("market")
                if name == "clob_book_token_id" and isinstance(data.get("market"), str):
                  condition_id = data.get("market")
              if "condition_id" in data:
                step["condition_id"] = data.get("condition_id")
              if "asset_id" in data:
                step["asset_id"] = data.get("asset_id")
          except Exception:
            pass
      except Exception as e:
        step["error"] = repr(e)
      result["steps"].append(step)

    if condition_id:
      for name, url in [
        ("clob_market_markets", f"https://clob.polymarket.com/markets/{condition_id}"),
        ("clob_market_market", f"https://clob.polymarket.com/market/{condition_id}"),
      ]:
        step: dict = {"name": name}
        try:
          resp = await client.get(url, timeout=10)
          step["status"] = resp.status_code
          step["preview"] = resp.text[:200]
          if resp.status_code == 200:
            try:
              data = resp.json()
              if isinstance(data, dict):
                step["keys"] = sorted(list(data.keys()))[:40]
                tokens = data.get("tokens")
                if isinstance(tokens, list) and tokens:
                  first = tokens[0] if isinstance(tokens[0], dict) else None
                  if isinstance(first, dict):
                    step["token_keys"] = sorted(list(first.keys()))[:40]
                    step["tokens_len"] = len(tokens)
            except Exception:
              pass
        except Exception as e:
          step["error"] = repr(e)
        result["steps"].append(step)
  return result

@app.get("/admin/diag/outcome")
async def admin_diag_outcome(
  token_id: str = Query(..., min_length=1),
  x_admin_token: str | None = Header(None, alias="X-Admin-Token"),
):
  _require_admin(x_admin_token)
  redis = Redis.from_url(settings.redis_url, decode_responses=True)
  try:
    resolved = await _resolve_outcome_from_token(redis, token_id)
    cached = await redis.get(f"token_outcome:{str(token_id).strip()}")
    return {"token_id": token_id, "outcome": resolved, "cache_value": cached}
  finally:
    await redis.aclose()


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
    last_alert = await redis.get("alert_created:last")
    return {"queues": queues, "last_alert": last_alert}
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
    last_alert = await redis.get("alert_created:last")
  finally:
    await redis.aclose()

  bot_token_present = bool(settings.telegram_bot_token)
  chat_id_present = bool(settings.telegram_alert_chat_id)
  return {
    "service": "alert-engine",
    "redis": {"host": _redact_netloc(settings.redis_url), "queues": queues, "last_alert": (last_alert or "")[:500] if last_alert else None},
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
  outcome: str | None = Query(None),
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
    "outcome": outcome,
    "side": side,
    "size": size,
    "price": price,
    "created_at": now.isoformat(),
  }
  redis = Redis.from_url(settings.redis_url, decode_responses=True)
  try:
    await redis.rpush(settings.alert_created_queue, json.dumps(payload))
    await redis.set("alert_created:last", json.dumps(payload), ex=86400)
  finally:
    await redis.aclose()

  direct = {"ok": False}
  if settings.telegram_bot_token and settings.telegram_alert_chat_id:
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    text = (
      "Forced Alert Test\n\n"
      f"Market:\n{market_question}\n\n"
      f"Outcome:\n{outcome}\n\n"
      f"Side:\n{side}\n\n"
      f"Size:\n${size}\n\n"
      f"Price:\n{price}\n\n"
      f"Whale Score:\n{whale_score}\n\n"
      f"Alert ID:\n{alert_id}"
    )
    async with httpx.AsyncClient() as client:
      resp = await client.post(
        url,
        json={
          "chat_id": settings.telegram_alert_chat_id,
          "text": text,
          "parse_mode": "HTML",
          "disable_web_page_preview": True,
        },
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
