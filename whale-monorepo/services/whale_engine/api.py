from datetime import datetime, timezone

from fastapi import Depends, FastAPI
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.config import settings
from shared.db import get_session
from shared.logging import configure_logging
from shared.models import Market, TradeRaw, WalletName, WhaleProfile, WhaleTrade


configure_logging(settings.log_level)

app = FastAPI(title="whale-engine")


def _normalize_wallet(value: str) -> str:
  v = (value or "").strip()
  return v.lower()


def _shorten_wallet(value: str) -> str:
  v = (value or "").strip()
  if len(v) <= 10:
    return v
  return f"{v[:6]}…{v[-4:]}"


@app.get("/health")
async def health():
  return {"status": "ok"}


@app.get("/whales/{wallet}")
async def whale_profile(wallet: str, session: AsyncSession = Depends(get_session)):
  addr = _normalize_wallet(wallet)
  if not addr:
    return {
      "wallet": wallet,
      "display_name": wallet,
      "total_volume": 0.0,
      "total_trades": 0,
      "win_rate": 0.0,
      "realized_pnl": 0.0,
      "top_markets": [],
      "recent_trades": [],
    }

  profile = (await session.execute(select(WhaleProfile).where(WhaleProfile.wallet_address == addr))).scalars().first()

  total_volume = float(profile.total_volume) if profile and profile.total_volume is not None else 0.0
  total_trades = int(profile.total_trades) if profile and profile.total_trades is not None else 0
  wins = int(profile.wins) if profile and profile.wins is not None else 0
  losses = int(profile.losses) if profile and profile.losses is not None else 0
  realized_pnl = float(profile.realized_pnl) if profile and profile.realized_pnl is not None else 0.0

  attempts = wins + losses
  win_rate = (wins / attempts) if attempts > 0 else 0.0

  name_row = (await session.execute(select(WalletName).where(WalletName.wallet_address == addr))).scalars().first()
  if name_row and (name_row.polymarket_username or name_row.ens_name):
    display_name = name_row.polymarket_username or name_row.ens_name
  else:
    display_name = _shorten_wallet(addr)

  top_markets_rows = (
    await session.execute(
      select(
        WhaleTrade.market_id,
        func.sum(TradeRaw.amount * TradeRaw.price).label("volume_usd"),
        func.max(TradeRaw.market_title).label("market_title"),
      )
      .join(TradeRaw, TradeRaw.trade_id == WhaleTrade.trade_id)
      .where(WhaleTrade.wallet_address == addr)
      .group_by(WhaleTrade.market_id)
      .order_by(func.sum(TradeRaw.amount * TradeRaw.price).desc())
      .limit(5)
    )
  ).all()

  top_markets = []
  for row in top_markets_rows:
    mid = row.market_id
    vol = float(row.volume_usd or 0)
    title = row.market_title
    if not title:
      market = (await session.execute(select(Market).where(Market.id == mid))).scalars().first()
      if market:
        title = market.title
    top_markets.append(
      {
        "market_id": mid,
        "market_title": title,
        "volume": vol,
      }
    )

  recent_rows = (
    await session.execute(
      select(WhaleTrade, TradeRaw)
      .join(TradeRaw, TradeRaw.trade_id == WhaleTrade.trade_id)
      .where(WhaleTrade.wallet_address == addr)
      .order_by(WhaleTrade.created_at.desc())
      .limit(20)
    )
  ).all()

  recent_trades = []
  for wt, tr in recent_rows:
    size = float(tr.amount) * float(tr.price)
    ts = tr.timestamp or datetime.now(timezone.utc)
    recent_trades.append(
      {
        "whale_trade_id": wt.id,
        "trade_id": wt.trade_id,
        "market_id": wt.market_id,
        "market_title": tr.market_title,
        "side": tr.side,
        "amount": float(tr.amount),
        "price": float(tr.price),
        "trade_usd": float(size),
        "whale_score": int(wt.whale_score),
        "created_at": ts.isoformat(),
      }
    )

  return {
    "wallet": addr,
    "display_name": display_name,
    "total_volume": total_volume,
    "total_trades": total_trades,
    "win_rate": win_rate,
    "realized_pnl": realized_pnl,
    "top_markets": top_markets,
    "recent_trades": recent_trades,
  }
