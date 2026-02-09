import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from shared.config import settings
from shared.db import insert
from shared.models import Market, TradeRaw


logger = logging.getLogger("trade_ingest.polymarket")


def normalize_key(value: str) -> str:
  v = value.strip()
  return v.lower() if v.startswith("0x") else v


def _normalize_market_id(raw: Any) -> str | None:
  if raw is None:
    return None
  if isinstance(raw, (list, tuple, set)):
    for x in raw:
      if x is not None and x != "":
        return normalize_key(str(x))
    return None
  if isinstance(raw, str):
    trimmed = raw.strip()
    if trimmed.startswith("[") and trimmed.endswith("]"):
      try:
        parsed = json.loads(trimmed)
      except Exception:
        parsed = None
      if isinstance(parsed, list):
        for x in parsed:
          if x is not None and x != "":
            return normalize_key(str(x))
        return None
    return normalize_key(trimmed) if trimmed else None
  return normalize_key(str(raw))


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

  market_raw = (
    t.get("asset_id")
    or t.get("asset")
    or t.get("tokenId")
    or t.get("token_id")
    or t.get("clobTokenId")
    or t.get("market_id")
    or t.get("marketId")
    or t.get("conditionId")
    or t.get("condition_id")
    or t.get("condition")
    or t.get("slug")
    or t.get("ticker")
  )
  if not market_raw:
    market = t.get("market")
    if isinstance(market, dict):
      market_raw = market.get("id") or market.get("market_id") or market.get("conditionId") or market.get("condition_id")
  market_id = _normalize_market_id(market_raw) or "unknown"
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

  title = t.get("title") or t.get("question")
  return {
    "trade_id": str(trade_id), 
    "market_id": market_id, 
    "wallet": wallet, 
    "side": side, 
    "amount": amount, 
    "price": price, 
    "timestamp": ts,
    "market_title": title
  }


async def fetch_trades(client: httpx.AsyncClient) -> list[dict[str, Any]]:
  primary_url = settings.polymarket_trades_url
  fallback_url = settings.polymarket_trades_url_fallback
  urls = [u for u in [primary_url, fallback_url] if u]
  if not urls:
    logger.warning("polymarket_trades_url_missing")
    return []

  now_ms = int(datetime.now().timestamp() * 1000)

  async def _fetch_one(url: str) -> list[dict[str, Any]]:
    sep = "&" if "?" in url else "?"
    fetch_url = f"{url}{sep}_t={now_ms}"

    last_error = "unknown_error"
    for attempt in range(1, 4):
      try:
        resp = await client.get(fetch_url, timeout=30)
        if resp.status_code in (401, 403):
          logger.warning(f"polymarket_fetch_auth_error url={url} status={resp.status_code}")
          return []

        if resp.status_code != 200:
          last_error = f"status={resp.status_code} body={resp.text[:200]}"
        else:
          try:
            data = resp.json()
          except Exception as e:
            last_error = f"invalid_json error={e}"
          else:
            trades: Any = []
            if isinstance(data, list):
              trades = data
            elif isinstance(data, dict):
              trades = data.get("trades") or data.get("data") or []

            if isinstance(trades, list) and trades:
              logger.info(f"polymarket_trades_fetched url={url} count={len(trades)}")
              return [t for t in trades if isinstance(t, dict)]
            last_error = "empty_or_unexpected_payload"
      except Exception as e:
        msg = str(e)
        last_error = f"request_failed error={msg}"
        if "No address associated with hostname" in msg:
          logger.warning(f"polymarket_fetch_dns_error url={url} {last_error}")
          return []

      logger.warning(f"polymarket_fetch_retry url={url} attempt={attempt} {last_error}")
      if attempt < 3:
        await asyncio.sleep(1 * attempt)

    return []

  primary = await _fetch_one(primary_url) if primary_url else []
  if primary:
    return primary
  if fallback_url:
    return await _fetch_one(fallback_url)
  return []


async def ingest_trades(session: AsyncSession) -> list[str]:
  proxies = settings.https_proxy or None
  async with httpx.AsyncClient(proxy=proxies) as client:
    raw_trades = await fetch_trades(client)

  if not raw_trades:
    return []

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

  logger.info(f"polymarket_trades_parsed total_fetched={len(raw_trades)} unique_parsed={len(rows)}")

  if not rows:
    return []

  for r in rows:
    title = r.get("market_title")
    if not title:
      continue
    await session.execute(
      insert(Market)
      .values(id=r["market_id"], title=title, status=None)
      .on_conflict_do_update(index_elements=[Market.id], set_={"title": title})
    )

  stmt = (
    insert(TradeRaw)
    .values(rows)
    .on_conflict_do_nothing(index_elements=[TradeRaw.trade_id])
    .returning(TradeRaw.trade_id)
  )
  inserted = (await session.execute(stmt)).scalars().all()
  return [str(tid) for tid in inserted]
