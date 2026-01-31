from datetime import datetime, timezone
import json
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from shared.config import settings
from shared.models import Market, TokenCondition


async def resolve_token_id(session: AsyncSession, token_id: str, title_hint: str | None = None) -> str | None:
    # Normalize token_id
    token_id = token_id.lower().strip()
    
    # 1. Check cache first
    cached = (await session.execute(select(TokenCondition).where(TokenCondition.token_id == token_id))).scalars().first()
    if cached:
        # If we have a hint and the cached question is generic, update it
        if title_hint and (cached.question.startswith("Market (") or cached.question == "unknown"):
            cached.question = title_hint
            await session.commit()
        return cached.question

    # 1.5 Use title_hint if provided (this is a very strong signal from the trades API)
    if title_hint:
        await _save_token_condition(session, token_id, f"cond_{token_id}", f"market_{token_id}", title_hint)
        return title_hint

    proxy = settings.https_proxy or None
    async with httpx.AsyncClient(proxy=proxy) as client:
        # 2. Try Tokens API (Layer 3 -> Layer 1)
        try:
            url = "https://gamma-api.polymarket.com/tokens"
            resp = await client.get(url, params={"tokenId": token_id}, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                token_data = data[0] if isinstance(data, list) and data else data
                if isinstance(token_data, dict):
                    market_data = token_data.get("market")
                    if isinstance(market_data, dict):
                        question = market_data.get("question")
                        cid = market_data.get("conditionId") or token_data.get("conditionId")
                        mid = market_data.get("id")
                        if question and mid:
                            await _save_token_condition(session, token_id, cid or "unknown", str(mid), question)
                            return question
        except Exception as e:
            print(f"Tokens API error for {token_id}: {e}")

        # 3. Try Markets API with clobTokenIds (Layer 3 -> Layer 1)
        try:
            url = "https://gamma-api.polymarket.com/markets"
            resp = await client.get(url, params={"clobTokenIds": token_id}, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list) and data:
                    # STRICT CHECK: Verify that the returned market actually contains this token_id
                    for market_data in data:
                        market_tokens = market_data.get("clobTokenIds")
                        # clobTokenIds is usually a JSON string like '["id1", "id2"]'
                        if market_tokens:
                            if isinstance(market_tokens, str):
                                try:
                                    market_tokens = json.loads(market_tokens)
                                except:
                                    pass
                            
                            if isinstance(market_tokens, list) and token_id in [str(t).lower() for t in market_tokens]:
                                question = market_data.get("question")
                                cid = market_data.get("conditionId")
                                mid = market_data.get("id")
                                if question and mid:
                                    await _save_token_condition(session, token_id, cid or "unknown", str(mid), question)
                                    return question
        except Exception as e:
            print(f"Markets API (clobTokenIds) error for {token_id}: {e}")

        # 4. Try Markets API with conditionIds (Layer 2 -> Layer 1)
        try:
            url = "https://gamma-api.polymarket.com/markets"
            resp = await client.get(url, params={"conditionIds": token_id}, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list) and data:
                    for market_data in data:
                        cid = market_data.get("conditionId")
                        if cid and cid.lower() == token_id:
                            question = market_data.get("question")
                            print(f"DEBUG: Resolved via Markets API (conditionIds): {question}")
                            mid = market_data.get("id")
                            if question and mid:
                                await _save_token_condition(session, token_id, cid, str(mid), question)
                                return question
        except Exception as e:
            print(f"Markets API (conditionIds) error for {token_id}: {e}")

        # 5. Try Markets API by slug/id (Layer 1 -> Layer 1)
        try:
            resp = await client.get(f"https://gamma-api.polymarket.com/markets/{token_id}", timeout=10)
            if resp.status_code == 200:
                market_data = resp.json()
                if isinstance(market_data, dict):
                    question = market_data.get("question")
                    cid = market_data.get("conditionId")
                    mid = market_data.get("id")
                    if question and mid:
                        await _save_token_condition(session, token_id, cid or "unknown", str(mid), question)
                        return question
        except Exception:
            pass

    # Final Fallback
    question = f"Market ({token_id[:8]}...)"
    await _save_token_condition(session, token_id, f"cond_{token_id}", f"market_{token_id}", question)
    return question

async def _save_token_condition(session: AsyncSession, token_id: str, condition_id: str, market_id: str, question: str):
    await session.execute(
        insert(TokenCondition)
        .values(
            token_id=token_id, 
            condition_id=condition_id, 
            market_id=market_id, 
            question=question
        )
        .on_conflict_do_update(
            index_elements=[TokenCondition.token_id],
            set_={
                "condition_id": condition_id,
                "market_id": market_id,
                "question": question
            }
        )
    )
    await session.commit()



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
    key = normalize_key(str(target_id))
    market = (await session.execute(select(Market).where(Market.id == key))).scalars().first()
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
