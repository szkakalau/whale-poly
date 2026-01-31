from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.config import settings
from shared.models import WalletName


def _normalize_wallet(value: str) -> str:
  v = (value or "").strip()
  return v.lower()


async def _fetch_polymarket_username(client: httpx.AsyncClient, wallet: str) -> str | None:
  url = "https://gamma-api.polymarket.com/public-profile"
  try:
    resp = await client.get(url, params={"walletAddress": wallet}, timeout=10)
  except Exception:
    return None
  if resp.status_code != 200:
    return None
  data: Any = resp.json()
  if not isinstance(data, dict):
    return None
  if data.get("displayUsernamePublic") is False:
    return None
  name = data.get("pseudonym") or data.get("name")
  if not name:
    return None
  return str(name)


async def _fetch_ens_name(client: httpx.AsyncClient, wallet: str) -> str | None:
  url = f"https://api.ensideas.com/ens/resolve/{wallet}"
  try:
    resp = await client.get(url, timeout=10)
  except Exception:
    return None
  if resp.status_code != 200:
    return None
  data: Any = resp.json()
  if not isinstance(data, dict):
    return None
  name = data.get("name")
  if not name:
    return None
  return str(name)


async def resolve_wallet_name(session: AsyncSession, wallet_address: str) -> str | None:
  addr = _normalize_wallet(wallet_address)
  if not addr:
    return None

  row = (await session.execute(select(WalletName).where(WalletName.wallet_address == addr))).scalars().first()
  if row and (row.polymarket_username or row.ens_name):
    return row.polymarket_username or row.ens_name

  proxies = settings.https_proxy or None
  async with httpx.AsyncClient(proxies=proxies) as client:
    pm = await _fetch_polymarket_username(client, addr)
    ens = await _fetch_ens_name(client, addr)

  if not row:
    row = WalletName(wallet_address=addr)
    session.add(row)

  sources: list[str] = []
  if pm:
    row.polymarket_username = pm
    sources.append("polymarket")
  if ens:
    row.ens_name = ens
    sources.append("ens")

  if sources:
    row.source = ",".join(sorted(set(sources)))
  elif not row.source:
    row.source = "none"

  row.updated_at = datetime.now(timezone.utc)

  return pm or ens

