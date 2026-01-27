from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from shared.config import settings
from shared.models import Market


def normalize_key(value: str) -> str:
  v = value.strip()
  return v.lower() if v.startswith("0x") else v


def _collect_ids(m: dict[str, Any]) -> set[str]:
  ids: set[str] = set()
  for k in ("id", "market_id", "slug", "ticker", "conditionId", "condition_id"):
    if m.get(k):
      ids.add(str(m.get(k)))
  clob = m.get("clobTokenIds")
  if isinstance(clob, list):
    for t in clob:
      if t:
        ids.add(str(t))
  tokens = m.get("tokens")
  if isinstance(tokens, list):
    for t in tokens:
      if isinstance(t, dict) and t.get("token_id"):
        ids.add(str(t.get("token_id")))
  return ids


async def ingest_markets(session: AsyncSession) -> int:
  url = settings.polymarket_markets_url
  if not url:
    return 0

  batch_size = 50
  offset = 0
  total_upserts = 0
  max_markets = 1000
  sep = "&" if "?" in url else "?"

  proxies = settings.https_proxy or None
  async with httpx.AsyncClient(proxies=proxies) as client:
    while offset < max_markets:
      resp = await client.get(f"{url}{sep}limit={batch_size}&offset={offset}&active=true", timeout=30)
      if resp.status_code != 200:
        break
      data = resp.json()
      markets = data if isinstance(data, list) else (data.get("markets") or data.get("data") or [])
      if not isinstance(markets, list) or not markets:
        break

      for m in markets:
        if not isinstance(m, dict):
          continue
        title = m.get("title") or m.get("question") or ""
        if not title:
          continue
        status = str(m.get("status") or "active")
        ids = _collect_ids(m)
        for raw_id in ids:
          key = normalize_key(str(raw_id))
          await session.execute(
            insert(Market)
            .values(id=key, title=str(title), status=status, created_at=datetime.now(timezone.utc))
            .on_conflict_do_update(index_elements=[Market.id], set_={"title": str(title), "status": status})
          )
          total_upserts += 1

      offset += batch_size
  return total_upserts


async def resolve_market_title(session: AsyncSession, target_id: str) -> str | None:
  url = settings.polymarket_markets_url
  if not url:
    return None

  target = normalize_key(str(target_id))
  batch_size = 50
  max_scan = 500
  sep = "&" if "?" in url else "?"

  proxies = settings.https_proxy or None
  async with httpx.AsyncClient(proxies=proxies) as client:
    offset = 0
    while offset < max_scan:
      resp = await client.get(f"{url}{sep}limit={batch_size}&offset={offset}&active=true", timeout=30)
      if resp.status_code != 200:
        break
      data = resp.json()
      markets = data if isinstance(data, list) else (data.get("markets") or data.get("data") or [])
      if not isinstance(markets, list) or not markets:
        break
      for m in markets:
        if not isinstance(m, dict):
          continue
        title = m.get("title") or m.get("question") or ""
        status = str(m.get("status") or "active")
        ids = {normalize_key(x) for x in _collect_ids(m)}
        if target in ids and title:
          # Upsert all related ids so future lookups succeed fast
          for raw_id in ids:
            await session.execute(
              insert(Market)
              .values(id=str(raw_id), title=str(title), status=status, created_at=datetime.now(timezone.utc))
              .on_conflict_do_update(index_elements=[Market.id], set_={"title": str(title), "status": status})
            )
          return str(title)
      offset += batch_size
  return None
