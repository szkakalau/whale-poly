from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI
from sqlalchemy import case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from shared.config import settings
from shared.db import get_session
from shared.logging import configure_logging
from shared.models import Market, MarketVwMetrics, MarketVwSnapshot, TradeRaw, WalletName, WhaleProfile, WhaleTrade, WhaleScore, WhaleTradeHistory, WhaleStats


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


@app.get("/diag/score-system")
async def diag_score_system(session: AsyncSession = Depends(get_session)):
  """
  Whale Score system diagnostics: table health, freshness, and score distribution.
  The stats engine (multi-window 5-factor model) is the sole scoring system.
  """
  try:
    whale_stats_reg = (await session.execute(text("select to_regclass('public.whale_stats')"))).scalar_one_or_none()
    whale_hist_reg = (await session.execute(text("select to_regclass('public.whale_trade_history')"))).scalar_one_or_none()
    has_whale_stats = bool(whale_stats_reg)
    has_whale_trade_history = bool(whale_hist_reg)
  except Exception:
    has_whale_stats = False
    has_whale_trade_history = False

  whale_stats_max_updated_at = None
  whale_stats_rows = None
  if has_whale_stats:
    try:
      whale_stats_max_updated_at = (
        await session.execute(text("select max(updated_at) from whale_stats"))
      ).scalar_one_or_none()
      whale_stats_rows = (
        await session.execute(text("select count(*) from whale_stats"))
      ).scalar_one_or_none()
    except Exception:
      whale_stats_max_updated_at = None
      whale_stats_rows = None

  whale_hist_max_ts = None
  whale_hist_rows = None
  if has_whale_trade_history:
    try:
      whale_hist_max_ts = (
        await session.execute(text("select max(timestamp) from whale_trade_history"))
      ).scalar_one_or_none()
      whale_hist_rows = (
        await session.execute(text("select count(*) from whale_trade_history"))
      ).scalar_one_or_none()
    except Exception:
      whale_hist_max_ts = None
      whale_hist_rows = None

  now = datetime.now(timezone.utc)
  stats_recent = False
  if isinstance(whale_stats_max_updated_at, datetime):
    dt = whale_stats_max_updated_at
    if dt.tzinfo is None:
      dt = dt.replace(tzinfo=timezone.utc)
    stats_recent = (now - dt).total_seconds() < 3600

  history_recent = False
  if isinstance(whale_hist_max_ts, datetime):
    dt = whale_hist_max_ts
    if dt.tzinfo is None:
      dt = dt.replace(tzinfo=timezone.utc)
    history_recent = (now - dt).total_seconds() < 3600

  # Score distribution for monitoring calibration
  distribution = None
  if has_whale_stats and whale_stats_rows:
    try:
      dist_result = await session.execute(text("""
        SELECT
          COUNT(*) FILTER (WHERE whale_score >= 90) AS tier_90_plus,
          COUNT(*) FILTER (WHERE whale_score >= 80 AND whale_score < 90) AS tier_80_89,
          COUNT(*) FILTER (WHERE whale_score >= 70 AND whale_score < 80) AS tier_70_79,
          COUNT(*) FILTER (WHERE whale_score < 70) AS tier_below_70,
          ROUND(AVG(whale_score)::numeric, 1) AS mean_score,
          MIN(whale_score) AS min_score,
          MAX(whale_score) AS max_score
        FROM whale_stats
      """))
      row = dist_result.first()
      if row:
        distribution = {
          "tier_90_plus": int(row.tier_90_plus),
          "tier_80_89": int(row.tier_80_89),
          "tier_70_79": int(row.tier_70_79),
          "tier_below_70": int(row.tier_below_70),
          "mean_score": float(row.mean_score) if row.mean_score is not None else None,
          "min_score": int(row.min_score) if row.min_score is not None else None,
          "max_score": int(row.max_score) if row.max_score is not None else None,
        }
    except Exception:
      pass

  def _iso(dt: object) -> str | None:
    if isinstance(dt, datetime):
      if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
      return dt.isoformat()
    return None

  return {
    "effective_system": "stats_engine" if has_whale_stats else "no_stats_table",
    "has_whale_stats": has_whale_stats,
    "whale_stats_rows": int(whale_stats_rows) if whale_stats_rows is not None else None,
    "whale_stats_max_updated_at": _iso(whale_stats_max_updated_at),
    "whale_stats_recent_1h": bool(stats_recent),
    "has_whale_trade_history": has_whale_trade_history,
    "whale_trade_history_rows": int(whale_hist_rows) if whale_hist_rows is not None else None,
    "whale_trade_history_max_timestamp": _iso(whale_hist_max_ts),
    "whale_trade_history_recent_1h": bool(history_recent),
    "score_distribution": distribution,
    "note": "Scores computed by stats_engine (multi-window 5-factor model). Distribution shows current calibration across alert tiers.",
  }


@app.get("/whales/{wallet}")
async def whale_profile(wallet: str, session: AsyncSession = Depends(get_session)):
  addr = _normalize_wallet(wallet)
  if not addr:
    return {
      "wallet": wallet,
      "display_name": wallet,
      "whale_score": 0,
      "whale_score_breakdown": None,
      "total_volume": 0.0,
      "total_trades": 0,
      "win_rate": 0.0,
      "realized_pnl": 0.0,
      "top_markets": [],
      "recent_trades": [],
    }

  profile = (await session.execute(select(WhaleProfile).where(WhaleProfile.wallet_address == addr))).scalars().first()
  stats_row = (await session.execute(select(WhaleStats).where(WhaleStats.wallet_address == addr))).scalars().first()

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

  whale_score = int(stats_row.whale_score) if stats_row and stats_row.whale_score is not None else 0
  whale_score_breakdown = None
  if stats_row:
    whale_score_breakdown = {
      "performance": float(stats_row.performance_score or 0.0),
      "consistency": float(stats_row.consistency_score or 0.0),
      "timing": float(stats_row.timing_score or 0.0),
      "risk": float(stats_row.risk_score or 0.0),
      "impact": float(stats_row.impact_score or 0.0),
    }

  return {
    "wallet": addr,
    "display_name": display_name,
    "whale_score": whale_score,
    "whale_score_breakdown": whale_score_breakdown,
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


# ── VW Analysis API ────────────────────────────────────────────

@app.get("/vw/metrics")
async def vw_metrics(
    sort_by: str = "volume",
    limit: int = 50,
    session: AsyncSession = Depends(get_session),
):
    """Fetch VW metrics for the volume-analysis page."""
    order_map = {
        "volume": "total_volume_usd DESC",
        "divergence": "ABS(vw_divergence) DESC NULLS LAST",
        "strength": "signal_strength DESC NULLS LAST",
    }
    order_clause = order_map.get(sort_by, "total_volume_usd DESC")

    rows = (
        await session.execute(
            text(f"""
                SELECT
                    vw.market_id,
                    m.title AS market_title,
                    vw.total_volume_usd::float,
                    vw.yes_volume_usd::float,
                    vw.no_volume_usd::float,
                    vw.yes_vw_price::float,
                    vw.no_vw_price::float,
                    vw.yes_market_price::float,
                    vw.vw_divergence::float,
                    vw.uai::float,
                    vw.vw_velocity_5m::float,
                    vw.signal_direction,
                    vw.signal_strength,
                    vw.status,
                    vw.computed_at
                FROM market_vw_metrics vw
                JOIN markets m ON vw.market_id = m.id
                WHERE vw.status = 'active'
                ORDER BY {order_clause}
                LIMIT {limit}
            """)
        )
    ).fetchall()

    data = [
        {
            "marketId": row[0],
            "marketTitle": row[1],
            "totalVolumeUsd": row[2],
            "yesVolumeUsd": row[3],
            "noVolumeUsd": row[4],
            "yesVwPrice": row[5],
            "noVwPrice": row[6],
            "yesMarketPrice": row[7],
            "vwDivergence": row[8],
            "uai": row[9],
            "vwVelocity5m": row[10],
            "signalDirection": row[11],
            "signalStrength": row[12],
            "status": row[13],
            "computedAt": row[14].isoformat() if row[14] else None,
        }
        for row in rows
    ]
    return {"data": data}


@app.get("/vw/snapshots")
async def vw_snapshots(
    marketId: str,
    hours: int = 24,
    session: AsyncSession = Depends(get_session),
):
    """Fetch snapshot data for a single market's divergence chart."""
    rows = (
        await session.execute(
            text("""
                SELECT
                    snapshot_at,
                    vw_divergence::float,
                    yes_market_price::float
                FROM market_vw_snapshots
                WHERE market_id = :mid
                  AND snapshot_at > NOW() - INTERVAL '1 hour' * :hours
                ORDER BY snapshot_at ASC
            """),
            {"mid": marketId, "hours": hours},
        )
    ).fetchall()

    data = [
        {
            "snapshotAt": row[0].isoformat() if row[0] else None,
            "vwDivergence": row[1],
            "yesMarketPrice": row[2],
        }
        for row in rows
    ]
    return {"data": data}


@app.get("/vw/cross")
async def vw_cross(
    marketId: str,
    session: AsyncSession = Depends(get_session),
):
    """Fetch Whale x VW cross signal for a single market."""
    rows = (
        await session.execute(
            text("""
                WITH whale_dir AS (
                    SELECT
                        market_id,
                        CASE
                            WHEN SUM(CASE WHEN wt.side = 'BUY' THEN wt.size * wt.price ELSE 0 END)
                                 > SUM(CASE WHEN wt.side = 'SELL' THEN wt.size * wt.price ELSE 0 END)
                            THEN 'bullish'
                            ELSE 'bearish'
                        END AS whale_direction
                    FROM whale_trade_history wt
                    WHERE wt.market_id = :mid
                      AND wt.timestamp > NOW() - INTERVAL '24 hours'
                    GROUP BY wt.market_id
                )
                SELECT
                    vw.market_id,
                    m.title AS market_title,
                    vw.signal_direction,
                    vw.vw_divergence::float,
                    wd.whale_direction
                FROM market_vw_metrics vw
                JOIN markets m ON vw.market_id = m.id
                LEFT JOIN whale_dir wd ON vw.market_id = wd.market_id
                WHERE vw.market_id = :mid
            """),
            {"mid": marketId},
        )
    ).fetchall()

    if not rows:
        return {"data": None}

    row = rows[0]
    vw_dir = row[2]
    whale_dir = row[4]
    # Derive confidence
    if vw_dir and whale_dir:
        if vw_dir == whale_dir:
            confidence = "high"
        elif (vw_dir == "bullish" and whale_dir == "bearish") or (vw_dir == "bearish" and whale_dir == "bullish"):
            confidence = "low"
        else:
            confidence = "medium"
    else:
        confidence = "medium"

    return {
        "data": {
            "marketId": row[0],
            "marketTitle": row[1],
            "vwDirection": vw_dir,
            "vwDivergence": row[3],
            "whaleDirection": whale_dir or "neutral",
            "confidenceLevel": confidence,
        }
    }

