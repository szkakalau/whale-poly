import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from shared.config import settings
from shared.db import insert
from shared.models import Market, TradeRaw, WhaleProfile, WhaleStats


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


def _extract_outcome(value: Any) -> str | None:
  if value is None:
    return None
  if isinstance(value, (list, tuple, set)):
    for x in value:
      v = _extract_outcome(x)
      if v:
        return v
    return None
  if isinstance(value, dict):
    for key in ("outcome", "outcome_name", "outcomeName", "tokenOutcome", "label", "name"):
      if key in value:
        v = _extract_outcome(value.get(key))
        if v:
          return v
    return None
  s = str(value).strip()
  return s or None


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
  outcome = _extract_outcome(t.get("outcome") or t.get("outcome_name") or t.get("outcomeName") or t.get("tokenOutcome"))
  if not outcome:
    outcome_idx = t.get("outcomeIndex")
    if outcome_idx is None:
      outcome_idx = t.get("outcome_index")
    try:
      idx = int(outcome_idx) if outcome_idx is not None else None
    except Exception:
      idx = None
    if idx == 0:
      outcome = "Yes"
    elif idx == 1:
      outcome = "No"
  if not outcome:
    for key in ("token", "asset", "market", "outcome_token", "outcomeToken"):
      outcome = _extract_outcome(t.get(key))
      if outcome:
        break
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
    "outcome": str(outcome) if outcome is not None and str(outcome).strip() else None,
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


async def fetch_leaderboard(client: httpx.AsyncClient, *, category: str = "OVERALL", time_period: str = "MONTH", order_by: str = "PNL", limit: int = 50) -> list[dict[str, Any]]:
  """
  Fetch trader leaderboard rankings from Polymarket Data API.
  Docs indicate: GET https://data-api.polymarket.com/v1/leaderboard
  Response items may include: proxyWallet, userName, vol, pnl, rank
  """
  base = "https://data-api.polymarket.com/v1/leaderboard"
  params = {
    "category": category,
    "timePeriod": time_period,
    "orderBy": order_by,
    "limit": max(1, min(int(limit), 50)),
  }

  async def _try(url: str) -> list[dict[str, Any]]:
    try:
      resp = await client.get(url, params=params, timeout=20)
    except Exception as e:
      logger.warning(f"leaderboard_request_failed error={e}")
      return []
    if resp.status_code != 200:
      logger.warning(f"leaderboard_bad_status status={resp.status_code} body={resp.text[:200]}")
      return []
    try:
      data = resp.json()
    except Exception as e:
      logger.warning(f"leaderboard_invalid_json error={e}")
      return []
    if isinstance(data, list):
      return [d for d in data if isinstance(d, dict)]
    if isinstance(data, dict):
      arr = data.get("data") or data.get("items") or []
      return [d for d in arr if isinstance(d, dict)]
    return []

  # Primary
  rows = await _try(base)
  if rows:
    return rows

  # Fallback guesses if path changes
  for alt in (
    "https://gamma-api.polymarket.com/leaderboard",
    "https://gamma-api.polymarket.com/trader-leaderboard",
  ):
    rows = await _try(alt)
    if rows:
      return rows
  return []


def _parse_leaderboard_row(row: dict[str, Any]) -> dict[str, Any] | None:
  wallet = row.get("proxyWallet") or row.get("wallet") or row.get("user")
  if not wallet:
    return None
  wallet = normalize_key(str(wallet))
  try:
    vol = float(row.get("vol") or row.get("volume") or 0)
  except Exception:
    vol = 0.0
  try:
    pnl = float(row.get("pnl") or row.get("profit") or 0)
  except Exception:
    pnl = 0.0
  roi = (pnl / vol) if vol > 0 else 0.0
  return {
    "wallet": wallet,
    "volume": vol,
    "pnl": pnl,
    "roi": roi,
  }


async def ingest_smart_money_leaderboard(session: AsyncSession, *, category: str = "OVERALL", time_period: str = "MONTH", order_by: str = "PNL", limit: int = 50) -> int:
  """
  Fetch and upsert smart money (top traders) into WhaleProfile + WhaleStats.
  """
  proxies = settings.https_proxy or None
  async with httpx.AsyncClient(proxy=proxies) as client:
    rows = await fetch_leaderboard(client, category=category, time_period=time_period, order_by=order_by, limit=limit)

  parsed = [_parse_leaderboard_row(r) for r in rows if isinstance(r, dict)]
  parsed = [p for p in parsed if p]
  if not parsed:
    logger.info("leaderboard_empty")
    return 0

  profile_rows = []
  stats_rows = []
  for p in parsed:
    profile_rows.append(
      {
        "wallet_address": p["wallet"],
        "total_volume": p["volume"],
        "total_trades": 0,
        "realized_pnl": p["pnl"],
        "wins": 0,
        "losses": 0,
        "updated_at": datetime.now(timezone.utc),
      }
    )
    stats_rows.append(
      {
        "wallet_address": p["wallet"],
        "whale_score": 0,
        "performance_score": 0.0,
        "consistency_score": 0.0,
        "timing_score": 0.0,
        "risk_score": 0.0,
        "impact_score": 0.0,
        "win_rate": 0.0,
        "roi": p["roi"],
        "total_pnl": p["pnl"],
        "avg_trade_size": 0,
        "max_drawdown": 0,
        "stddev_pnl": 0,
        "avg_entry_percentile": 0.5,
        "avg_exit_percentile": 0.5,
        "risk_reward_ratio": 0.0,
        "market_liquidity_ratio": 0.0,
        "updated_at": datetime.now(timezone.utc),
      }
    )

  if profile_rows:
    profile_insert = insert(WhaleProfile).values(profile_rows)
    profile_stmt = profile_insert.on_conflict_do_update(
      index_elements=[WhaleProfile.wallet_address],
      set_={
        "total_volume": profile_insert.excluded.total_volume,
        "realized_pnl": profile_insert.excluded.realized_pnl,
        "updated_at": profile_insert.excluded.updated_at,
      },
    )
    await session.execute(profile_stmt)

  if stats_rows:
    stats_insert = insert(WhaleStats).values(stats_rows)
    stats_stmt = stats_insert.on_conflict_do_update(
      index_elements=[WhaleStats.wallet_address],
      set_={
        "roi": stats_insert.excluded.roi,
        "total_pnl": stats_insert.excluded.total_pnl,
        "updated_at": stats_insert.excluded.updated_at,
      },
    )
    await session.execute(stats_stmt)

  return len(parsed)
