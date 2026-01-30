from datetime import datetime, timezone
import json
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from shared.config import settings
from shared.models import Market, TokenCondition


async def resolve_token_id(session: AsyncSession, token_id: str) -> str | None:
    # 1. Check cache first
    cached = (await session.execute(select(TokenCondition).where(TokenCondition.token_id == token_id))).scalars().first()
    if cached:
        return cached.question

    # 2. Query chain or API to obtain condition_id
    # This is a placeholder for the actual chain/API query
    # In a real implementation, you would use a library like web3.py or an API client
    condition_id = f"cond_{token_id}"
    market_id = f"market_{token_id}"
    question = f"Question for {token_id}?"

    # 3. Cache the mapping
    await session.execute(
        insert(TokenCondition)
        .values(token_id=token_id, condition_id=condition_id, market_id=market_id, question=question)
        .on_conflict_do_nothing()
    )
    await session.commit()

    return question



def normalize_key(value: str) -> str:
  v = value.strip()
  return v.lower() if v.startswith("0x") else v


def _expand_id_values(value: Any) -> list[str]:
  if value is None:
    return []
  if isinstance(value, (list, tuple, set)):
    return [str(x) for x in value if x is not None and x != ""]
  if isinstance(value, str):
    trimmed = value.strip()
    if trimmed.startswith("[") and trimmed.endswith("]"):
      try:
        parsed = json.loads(trimmed)
      except Exception:
        parsed = None
      if isinstance(parsed, list):
        return [str(x) for x in parsed if x is not None and x != ""]
    return [trimmed] if trimmed else []
  return [str(value)]


def _collect_ids(m: dict[str, Any]) -> set[str]:
  ids: set[str] = set()
  id_keys = {
    "id",
    "market_id",
    "marketId",
    "slug",
    "ticker",
    "conditionId",
    "condition_id",
    "token_id",
    "tokenId",
    "clobTokenId",
    "clobTokenIds",
  }

  def _walk(obj: Any) -> None:
    if obj is None:
      return
    if isinstance(obj, dict):
      for k, v in obj.items():
        if k in id_keys:
          for x in _expand_id_values(v):
            if x is not None and x != "":
              ids.add(str(x))
        _walk(v)
      return
    if isinstance(obj, list):
      for x in obj:
        _walk(x)
      return

  _walk(m)
  return ids


def _extract_market_records(data: Any) -> list[dict[str, Any]]:
  if isinstance(data, list):
    items = [x for x in data if isinstance(x, dict)]
  elif isinstance(data, dict):
    maybe = data.get("markets") or data.get("data") or data.get("market")
    if isinstance(maybe, list):
      items = [x for x in maybe if isinstance(x, dict)]
    elif isinstance(maybe, dict):
      items = [maybe]
    else:
      items = [data]
  else:
    items = []

  out: list[dict[str, Any]] = []
  for item in items:
    parent_title = item.get("title") or item.get("question") or ""
    parent_status = str(item.get("status") or ("active" if item.get("active") is True else "active"))
    parent_ids = {normalize_key(x) for x in _collect_ids(item)}

    nested = item.get("markets")
    if isinstance(nested, list) and any(isinstance(x, dict) for x in nested):
      for child in nested:
        if not isinstance(child, dict):
          continue
        title = child.get("title") or child.get("question") or parent_title or ""
        status = str(child.get("status") or parent_status or "active")
        ids = parent_ids | {normalize_key(x) for x in _collect_ids(child)}
        out.append({"title": str(title), "status": status, "ids": ids})
      continue

    out.append({"title": str(parent_title), "status": parent_status, "ids": parent_ids})

  return out


async def _upsert_market(session: AsyncSession, title: str, status: str, ids: set[str]) -> None:
  for raw_id in ids:
    key = normalize_key(str(raw_id))
    await session.execute(
      insert(Market)
      .values(id=key, title=str(title), status=status, created_at=datetime.now(timezone.utc))
      .on_conflict_do_update(index_elements=[Market.id], set_={"title": str(title), "status": status})
    )


async def _fetch_market_by_id(client: httpx.AsyncClient, url: str, target_id: str) -> list[dict[str, Any]]:
  raw_target = str(target_id).strip()
  targets: list[str] = []
  for t in (raw_target, normalize_key(raw_target)):
    if t and t not in targets:
      targets.append(t)

  urls: list[str] = []
  for t in targets:
    sep = "&" if "?" in url else "?"
    for param in ("id", "market_id", "conditionId", "condition_id", "slug", "ticker", "token_id", "clobTokenId", "clobTokenIds"):
      urls.append(f"{url}{sep}{param}={t}")
    urls.append(f"{url.rstrip('/')}/{t}")

  for candidate in urls:
    resp = await client.get(candidate, timeout=30)
    if resp.status_code != 200:
      continue
    records = _extract_market_records(resp.json())
    if records:
      return records
  return []


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
      records = _extract_market_records(resp.json())
      if not records:
        break

      for r in records:
        if not isinstance(r, dict):
          continue
        title = str(r.get("title") or "")
        if not title:
          continue
        status = str(r.get("status") or "active")
        ids = r.get("ids") or set()
        if not isinstance(ids, set) or not ids:
          continue
        await _upsert_market(session, str(title), status, ids)
        total_upserts += len(ids)

      offset += batch_size
  return total_upserts


async def resolve_market_title(session: AsyncSession, target_id: str) -> str | None:
    # 1. Address mapping
    title = await _resolve_by_address(session, target_id)
    if title:
        return title

    # 2. Token mapping
    title = await resolve_token_id(session, target_id)
    if title:
        return title

    # 3. Condition mapping
    # The existing logic already handles this, so we just need to call it.
    # The function is renamed to _resolve_by_condition for clarity.
    title = await _resolve_by_condition(session, target_id)
    if title:
        return title

    return None


async def _resolve_by_address(session: AsyncSession, target_id: str) -> str | None:
    market = (await session.execute(select(Market).where(Market.id == target_id))).scalars().first()
    if market:
        return market.title
    return None


async def _resolve_by_condition(session: AsyncSession, target_id: str) -> str | None:
    url = settings.polymarket_events_url
    if not url:
        return None

    target = normalize_key(str(target_id))
    batch_size = 50
    max_scan = 1000
    sep = "&" if "?" in url else "?"

    proxies = settings.https_proxy or None
    async with httpx.AsyncClient(proxies=proxies) as client:
        direct = await _fetch_market_by_id(client, url, target_id)
        if direct:
            for r in direct:
                if not isinstance(r, dict):
                    continue
                title = str(r.get("title") or "")
                if not title:
                    continue
                status = str(r.get("status") or "active")
                ids = r.get("ids") or set()
                if not isinstance(ids, set):
                    continue
                
                if target not in ids:
                    continue

                await _upsert_market(session, str(title), status, ids)
                return str(title)

        offset = 0
        while offset < max_scan:
            resp = await client.get(f"{url}{sep}limit={batch_size}&offset={offset}&active=true", timeout=30)
            if resp.status_code != 200:
                break
            records = _extract_market_records(resp.json())
            if not records:
                break
            for r in records:
                if not isinstance(r, dict):
                    continue
                title = str(r.get("title") or "")
                if not title:
                    continue
                status = str(r.get("status") or "active")
                ids = r.get("ids") or set()
                if not isinstance(ids, set):
                    continue
                if target in ids:
                    await _upsert_market(session, str(title), status, ids)
                    return str(title)
            offset += batch_size
    return None
