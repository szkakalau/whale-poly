import json
from datetime import datetime, timezone
from typing import Any

import httpx
from redis.asyncio import Redis
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from shared.config import settings
from shared.models import TradeRaw


def normalize_key(value: str) -> str:
  v = value.strip()
  return v.lower() if v.startswith("0x") else v


def _parse_ts(raw: Any) -> datetime | None:
  if raw is None:
    return None
  ts_num: float | None = None
  if isinstance(raw, (int, float)):
    ts_num = float(raw)
  else:
    try:
      ts_num = float(str(raw))
    except Exception:
      return None
  if ts_num != ts_num:
    return None
  if ts_num < 10000000000:
    ts_num *= 1000
  dt = datetime.fromtimestamp(ts_num / 1000, tz=timezone.utc)
  return dt


def parse_trade(t: dict[str, Any]) -> dict[str, Any] | None:
  trade_id = t.get("trade_id") or t.get("id") or t.get("transactionHash")
  if not trade_id:
    return None

  market_raw = str(t.get("market_id") or t.get("conditionId") or t.get("asset") or "unknown")
  market_id = normalize_key(market_raw)
  wallet = t.get("wallet") or t.get("maker") or t.get("taker") or t.get("proxyWallet") or "unknown"
  wallet = normalize_key(str(wallet))
  side = str(t.get("side") or "").lower()
  side = "sell" if side == "sell" else "buy"
  amount_raw = t.get("amount")
  if amount_raw is None:
    amount_raw = t.get("size")
  price_raw = t.get("price") or 0

  ts_raw = t.get("timestamp")
  if ts_raw is None:
    ts_raw = t.get("created_at")
  if ts_raw is None:
    ts_raw = t.get("time")
  if ts_raw is None:
    ts_raw = t.get("match_time")
  ts = _parse_ts(ts_raw)
  if not ts:
    return None

  if (datetime.now(timezone.utc) - ts).total_seconds() > 7 * 24 * 60 * 60:
    return None

  try:
    amount = float(amount_raw or 0)
    price = float(price_raw or 0)
  except Exception:
    return None

  return {"trade_id": str(trade_id), "market_id": market_id, "wallet": wallet, "side": side, "amount": amount, "price": price, "timestamp": ts}


async def fetch_trades(client: httpx.AsyncClient) -> list[dict[str, Any]]:
  url = settings.polymarket_trades_url
  if not url:
    return []
  resp = await client.get(url, timeout=30)
  if resp.status_code != 200:
    return []
  data = resp.json()
  if isinstance(data, list):
    return data
  trades = data.get("trades") if isinstance(data, dict) else None
  return trades if isinstance(trades, list) else []


async def ingest_trades(session: AsyncSession, redis: Redis) -> int:
  proxies = settings.https_proxy or None
  async with httpx.AsyncClient(proxies=proxies) as client:
    raw_trades = await fetch_trades(client)

  seen = set()
  rows: list[dict[str, Any]] = []
  for t in raw_trades:
    if not isinstance(t, dict):
      continue
    parsed = parse_trade(t)
    if not parsed:
      continue
    tid = parsed["trade_id"]
    if tid in seen:
      continue
    seen.add(tid)
    rows.append(parsed)

  if not rows:
    return 0

  stmt = (
    insert(TradeRaw)
    .values(rows)
    .on_conflict_do_nothing(index_elements=[TradeRaw.trade_id])
    .returning(TradeRaw.trade_id)
  )
  inserted = (await session.execute(stmt)).scalars().all()
  if inserted:
    await redis.rpush(settings.trade_created_queue, *[json.dumps({"trade_id": tid}) for tid in inserted])
  return len(inserted)

