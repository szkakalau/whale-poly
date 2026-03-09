from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.config import settings
from shared.db import get_session
from shared.logging import configure_logging
from shared.models import Market, TradeRaw, WalletName, WhaleProfile, WhaleTrade, WhaleScore, WhaleTradeHistory


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


async def _fetch_history_agg(session: AsyncSession, wallet: str, since: datetime | None) -> dict[str, float] | None:
  try:
    stmt = select(
      func.count(WhaleTradeHistory.trade_id).label("trades"),
      func.coalesce(func.sum(WhaleTradeHistory.trade_usd), 0).label("volume"),
      func.coalesce(func.sum(WhaleTradeHistory.pnl), 0).label("pnl"),
      func.coalesce(func.sum(case((WhaleTradeHistory.pnl > 0, 1), else_=0)), 0).label("wins"),
      func.coalesce(func.sum(case((WhaleTradeHistory.pnl < 0, 1), else_=0)), 0).label("losses"),
    ).where(WhaleTradeHistory.wallet_address == wallet)
    if since is not None:
      stmt = stmt.where(WhaleTradeHistory.timestamp >= since)
    row = (await session.execute(stmt)).first()
    if not row:
      return None
    mapping = row._mapping
    trades = float(mapping["trades"] or 0)
    volume = float(mapping["volume"] or 0)
    pnl = float(mapping["pnl"] or 0)
    wins = float(mapping["wins"] or 0)
    losses = float(mapping["losses"] or 0)
    attempts = wins + losses
    win_rate = wins / attempts if attempts > 0 else 0.0
    return {
      "trades": trades,
      "volume": volume,
      "pnl": pnl,
      "wins": wins,
      "losses": losses,
      "win_rate": win_rate,
    }
  except Exception:
    return None


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

  now = datetime.now(timezone.utc)
  since30 = now - timedelta(days=30)
  history_all = await _fetch_history_agg(session, addr, None)
  history_30d = await _fetch_history_agg(session, addr, since30)

  if history_all and history_all["trades"] > 0:
    total_volume = float(history_all["volume"])
    total_trades = int(history_all["trades"])
    realized_pnl = float(history_all["pnl"])
    wins = int(history_all["wins"])
    losses = int(history_all["losses"])

  attempts = wins + losses
  win_rate = (wins / attempts) if attempts > 0 else 0.0

  name_row = (await session.execute(select(WalletName).where(WalletName.wallet_address == addr))).scalars().first()
  if name_row and (name_row.polymarket_username or name_row.ens_name):
    display_name = name_row.polymarket_username or name_row.ens_name
  else:
    display_name = _shorten_wallet(addr)

  top_markets: list[dict[str, object]] = []
  try:
    top_markets_rows = (
      await session.execute(
        select(
          WhaleTradeHistory.market_id,
          func.count().label("trades"),
          func.coalesce(func.sum(WhaleTradeHistory.trade_usd), 0).label("volume_usd"),
          func.coalesce(func.sum(WhaleTradeHistory.pnl), 0).label("pnl_usd"),
          func.max(Market.title).label("market_title"),
        )
        .outerjoin(Market, Market.id == WhaleTradeHistory.market_id)
        .where(WhaleTradeHistory.wallet_address == addr)
        .group_by(WhaleTradeHistory.market_id)
        .order_by(func.sum(WhaleTradeHistory.trade_usd).desc())
        .limit(5)
      )
    ).all()

    for row in top_markets_rows:
      mid = row.market_id
      vol = float(row.volume_usd or 0)
      pnl = float(row.pnl_usd or 0)
      trades = int(row.trades or 0)
      title = row.market_title
      if not title:
        market = (await session.execute(select(Market).where(Market.id == mid))).scalars().first()
        if market:
          title = market.title
      market_label = title or mid
      top_markets.append(
        {
          "market": market_label,
          "market_id": mid,
          "market_title": title,
          "trades": trades,
          "volume": vol,
          "pnl": pnl,
        }
      )
  except Exception:
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

    for row in top_markets_rows:
      mid = row.market_id
      vol = float(row.volume_usd or 0)
      title = row.market_title
      if not title:
        market = (await session.execute(select(Market).where(Market.id == mid))).scalars().first()
        if market:
          title = market.title
      market_label = title or mid
      top_markets.append(
        {
          "market": market_label,
          "market_id": mid,
          "market_title": title,
          "trades": 0,
          "volume": vol,
          "pnl": 0.0,
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
  recent_for_behavior = []
  for wt, tr in recent_rows:
    size = float(tr.amount) * float(tr.price)
    ts = tr.timestamp or datetime.now(timezone.utc)
    side = str(tr.side or "")
    market_title = tr.market_title or wt.market_id
    recent_trades.append(
      {
        "whale_trade_id": wt.id,
        "trade_id": wt.trade_id,
        "market_id": wt.market_id,
        "market_title": tr.market_title,
        "side": side,
        "amount": float(tr.amount),
        "price": float(tr.price),
        "trade_usd": float(size),
        "whale_score": int(wt.whale_score),
        "created_at": ts.isoformat(),
        "time": ts.isoformat(),
        "market": market_title,
        "action": "Trade",
        "size": float(size),
      }
    )
    recent_for_behavior.append(
      {
        "side": side,
        "size": float(size),
      }
    )

  buy_count = sum(1 for t in recent_for_behavior if str(t["side"]).lower() == "buy")
  sell_count = sum(1 for t in recent_for_behavior if str(t["side"]).lower() == "sell")
  side_bias = "Neutral"
  if buy_count != sell_count:
    side_bias = "Buy" if buy_count > sell_count else "Sell"
  avg_trade_size = (
    sum(float(t["size"]) for t in recent_for_behavior) / len(recent_for_behavior)
    if recent_for_behavior
    else 0.0
  )

  performance_30d = {
    "pnl": float(history_30d["pnl"]) if history_30d else 0.0,
    "win_rate": float(history_30d["win_rate"]) if history_30d else 0.0,
    "volume": float(history_30d["volume"]) if history_30d else 0.0,
  }

  return {
    "wallet": addr,
    "display_name": display_name,
    "total_volume": total_volume,
    "total_trades": total_trades,
    "win_rate": win_rate,
    "realized_pnl": realized_pnl,
    "stats": {
      "total_volume": total_volume,
      "total_trades": total_trades,
      "win_rate": win_rate,
      "realized_pnl": realized_pnl,
    },
    "performance_30d": performance_30d,
    "top_markets": top_markets,
    "recent_trades": recent_trades,
    "behavior": {
      "common_action": "Trade",
      "avg_trade_size": avg_trade_size,
      "side_bias": side_bias,
    },
  }


@app.get("/whales/leaderboard")
async def whales_leaderboard(limit: int = 50, session: AsyncSession = Depends(get_session)):
  now = datetime.now(timezone.utc)
  since = now - timedelta(days=30)

  rows = (
    await session.execute(
      select(
        WhaleScore.wallet_address,
        WhaleScore.final_score.label("whale_score"),
        func.coalesce(func.sum(TradeRaw.amount * TradeRaw.price), 0).label("volume_30d"),
      )
      .join(WhaleTrade, WhaleTrade.wallet_address == WhaleScore.wallet_address)
      .join(TradeRaw, TradeRaw.trade_id == WhaleTrade.trade_id)
      .where(TradeRaw.timestamp >= since)
      .group_by(WhaleScore.wallet_address, WhaleScore.final_score)
      .order_by(WhaleScore.final_score.desc(), func.sum(TradeRaw.amount * TradeRaw.price).desc())
      .limit(limit)
    )
  ).all()

  addresses = [r.wallet_address for r in rows]
  name_rows = []
  if addresses:
    name_rows = (
      await session.execute(select(WalletName).where(WalletName.wallet_address.in_(addresses)))
    ).scalars().all()
  name_map = {n.wallet_address: n for n in name_rows}

  items = []
  for r in rows:
    addr = r.wallet_address
    score = int(r.whale_score or 0)
    vol_30d = float(r.volume_30d or 0.0)
    name_row = name_map.get(addr)
    if name_row and (name_row.polymarket_username or name_row.ens_name):
      display_name = name_row.polymarket_username or name_row.ens_name
    else:
      display_name = _shorten_wallet(addr)

    items.append(
      {
        "wallet": addr,
        "display_name": display_name,
        "whale_score": score,
        "volume_30d": vol_30d,
        "pnl_30d": 0.0,
        "win_rate_30d": 0.0,
      }
    )

  return {"whales": items}
