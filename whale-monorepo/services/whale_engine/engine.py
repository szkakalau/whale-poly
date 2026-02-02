import hashlib
import json
import logging
import math
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass

from redis.asyncio import Redis
from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from shared.config import settings
from shared.models import TradeRaw, Wallet, WhaleScore, WhaleTrade, WhaleProfile, WhalePosition, WhaleTradeHistory, WhaleStats


logger = logging.getLogger("whale_engine.engine")

_HAS_WHALE_POSITIONS_TABLE: bool | None = None
_HAS_WHALE_TRADES_ACTION_TYPE_COLUMN: bool | None = None
_HAS_WHALE_PROFILES_TABLE: bool | None = None
_HAS_WHALE_TRADE_HISTORY_TABLE: bool | None = None
_HAS_WHALE_STATS_TABLE: bool | None = None


async def _ensure_schema_flags(session: AsyncSession) -> tuple[bool, bool, bool, bool, bool]:
  global _HAS_WHALE_POSITIONS_TABLE, _HAS_WHALE_TRADES_ACTION_TYPE_COLUMN, _HAS_WHALE_PROFILES_TABLE, _HAS_WHALE_TRADE_HISTORY_TABLE, _HAS_WHALE_STATS_TABLE

  if _HAS_WHALE_POSITIONS_TABLE is None:
    try:
      _HAS_WHALE_POSITIONS_TABLE = bool((await session.execute(text("select to_regclass('public.whale_positions')"))).scalar_one_or_none())
    except Exception:
      _HAS_WHALE_POSITIONS_TABLE = False

  if _HAS_WHALE_PROFILES_TABLE is None:
    try:
      _HAS_WHALE_PROFILES_TABLE = bool((await session.execute(text("select to_regclass('public.whale_profiles')"))).scalar_one_or_none())
    except Exception:
      _HAS_WHALE_PROFILES_TABLE = False

  if _HAS_WHALE_TRADES_ACTION_TYPE_COLUMN is None:
    try:
      _HAS_WHALE_TRADES_ACTION_TYPE_COLUMN = bool(
        (await session.execute(
          text(
            "select 1 from information_schema.columns "
            "where table_schema='public' and table_name='whale_trades' and column_name='action_type' "
            "limit 1"
          )
        )).first()
      )
    except Exception:
      _HAS_WHALE_TRADES_ACTION_TYPE_COLUMN = False

  if _HAS_WHALE_TRADE_HISTORY_TABLE is None:
    try:
      _HAS_WHALE_TRADE_HISTORY_TABLE = bool((await session.execute(text("select to_regclass('public.whale_trade_history')"))).scalar_one_or_none())
    except Exception:
      _HAS_WHALE_TRADE_HISTORY_TABLE = False

  if _HAS_WHALE_STATS_TABLE is None:
    try:
      _HAS_WHALE_STATS_TABLE = bool((await session.execute(text("select to_regclass('public.whale_stats')"))).scalar_one_or_none())
    except Exception:
      _HAS_WHALE_STATS_TABLE = False

  return _HAS_WHALE_POSITIONS_TABLE, _HAS_WHALE_TRADES_ACTION_TYPE_COLUMN, _HAS_WHALE_PROFILES_TABLE, _HAS_WHALE_TRADE_HISTORY_TABLE, _HAS_WHALE_STATS_TABLE


def _id(trade_id: str) -> str:
  return hashlib.sha1(f"wt:{trade_id}".encode("utf-8")).hexdigest()[:32]


async def compute_whale_score(session: AsyncSession, wallet: str) -> int:
  now = datetime.now(timezone.utc)
  _, _, _, _, has_stats = await _ensure_schema_flags(session)
  if has_stats:
    try:
      row = (await session.execute(select(WhaleStats).where(WhaleStats.wallet_address == wallet))).scalars().first()
      if row and row.whale_score is not None:
        return int(row.whale_score)
    except Exception:
      pass
  since = now - timedelta(days=30)
  try:
    total = (
      await session.execute(
        select(func.coalesce(func.sum(TradeRaw.amount * TradeRaw.price), 0)).where(TradeRaw.wallet == wallet).where(TradeRaw.timestamp >= since)
      )
    ).scalar_one()
  except Exception:
    total = 0
  usd_30d = float(total or 0)

  base = 50
  if usd_30d >= 50000:
    base = 95
  elif usd_30d >= 20000:
    base = 88
  elif usd_30d >= 10000:
    base = 80
  elif usd_30d >= 5000:
    base = 70

  _, _, has_profiles, _, _ = await _ensure_schema_flags(session)
  if not has_profiles:
    return base

  try:
    profile = (
      await session.execute(
        select(WhaleProfile).where(WhaleProfile.wallet_address == wallet)
      )
    ).scalars().first()
  except Exception:
    profile = None
  if not profile:
    return base

  try:
    total_volume = float(profile.total_volume or 0)
    realized_pnl = float(profile.realized_pnl or 0)
    wins = int(profile.wins or 0)
    losses = int(profile.losses or 0)
  except Exception:
    return base
  attempts = wins + losses

  score = float(base)

  if attempts > 0 and total_volume > 0:
    win_rate = wins / attempts
    roi = realized_pnl / total_volume

    if attempts >= 10:
      if win_rate >= 0.65:
        score += 7
      elif win_rate >= 0.55:
        score += 3
      elif win_rate < 0.4:
        score -= 5
    else:
      score -= 5

    if roi >= 0.5:
      score += 7
    elif roi >= 0.2:
      score += 3
    elif roi <= -0.3:
      score -= 7
    elif roi <= -0.1:
      score -= 3

    if attempts < 10:
      score -= 3
    elif attempts < 30:
      score -= 1

  if score < 0:
    return 0
  if score > 100:
    return 100
  return int(round(score))


@dataclass(frozen=True)
class _PositionUpdate:
  new_size: float
  new_avg: float
  realized_pnl: float
  action_type: str


def _apply_trade_to_position(prev_size: float, prev_avg: float, side: str, amount: float, price: float) -> _PositionUpdate:
  s = (side or "").lower()
  amt = float(amount or 0.0)
  px = float(price or 0.0)
  if amt <= 0 or px <= 0:
    action = "entry" if s != "sell" else "exit"
    return _PositionUpdate(new_size=prev_size, new_avg=prev_avg, realized_pnl=0.0, action_type=action)

  if s == "buy":
    delta = amt
  else:
    delta = -amt

  new_size = prev_size + delta
  realized = 0.0

  prev_sign = 0 if abs(prev_size) < 1e-12 else (1 if prev_size > 0 else -1)
  new_sign = 0 if abs(new_size) < 1e-12 else (1 if new_size > 0 else -1)

  if prev_sign == 0:
    new_avg = px if new_sign != 0 else 0.0
  elif new_sign == 0:
    if prev_sign > 0 and delta < 0:
      realized = (px - prev_avg) * abs(prev_size)
    elif prev_sign < 0 and delta > 0:
      realized = (prev_avg - px) * abs(prev_size)
    new_avg = 0.0
  elif prev_sign == new_sign:
    if abs(new_size) > abs(prev_size):
      added = abs(new_size) - abs(prev_size)
      new_avg = ((prev_avg * abs(prev_size)) + (px * added)) / abs(new_size)
    else:
      new_avg = prev_avg
      if prev_sign > 0 and delta < 0:
        realized = (px - prev_avg) * abs(delta)
      elif prev_sign < 0 and delta > 0:
        realized = (prev_avg - px) * abs(delta)
  else:
    if prev_sign > 0 and delta < 0:
      realized = (px - prev_avg) * abs(prev_size)
    elif prev_sign < 0 and delta > 0:
      realized = (prev_avg - px) * abs(prev_size)
    new_avg = px

  eps = 1e-9
  if abs(prev_size) < eps and abs(new_size) > eps:
    action_type = "entry"
  elif abs(prev_size) > eps and abs(new_size) < eps:
    action_type = "exit"
  elif prev_sign == new_sign and abs(new_size) > abs(prev_size) + eps:
    action_type = "add"
  elif prev_sign == new_sign and abs(new_size) < abs(prev_size) - eps:
    action_type = "reduce"
  elif prev_sign != 0 and new_sign != 0 and prev_sign != new_sign:
    action_type = "entry"
  else:
    action_type = "entry" if s != "sell" else "exit"

  if math.isfinite(realized) is False:
    realized = 0.0

  return _PositionUpdate(new_size=float(new_size), new_avg=float(new_avg), realized_pnl=float(realized), action_type=action_type)


def _usd(t: TradeRaw) -> float:
  return float(t.amount) * float(t.price)


def detect_behavior(trades: list[TradeRaw], now: datetime) -> tuple[str | None, int, float, float, str | None]:
  window10 = [t for t in trades if (now - t.timestamp).total_seconds() <= 10 * 60]
  buys10 = [t for t in window10 if (t.side or "").lower() == "buy"]
  sells10 = [t for t in window10 if (t.side or "").lower() == "sell"]

  single_large = next((t for t in trades if _usd(t) >= settings.whale_single_trade_usd_threshold), None)
  if single_large:
    return ("spike", 80, float(single_large.amount), float(single_large.price), str(single_large.side))

  buy_val = sum(_usd(t) for t in buys10)
  sell_val = sum(_usd(t) for t in sells10)
  if len(buys10) >= 3 and buy_val >= settings.whale_build_usd_threshold:
    total_amount = sum(float(t.amount) for t in buys10)
    avg_price = (buy_val / total_amount) if total_amount > 0 else 0.0
    return ("build", 75, total_amount, avg_price, "buy")

  buy_vol = sum(float(t.amount) for t in buys10)
  sell_vol = sum(float(t.amount) for t in sells10)
  if buy_vol > 0 and sell_vol >= 0.5 * buy_vol and sell_val >= settings.whale_exit_usd_threshold:
    total_amount = sum(float(t.amount) for t in sells10)
    avg_price = (sell_val / total_amount) if total_amount > 0 else 0.0
    return ("exit", 85, total_amount, avg_price, "sell")

  return (None, 0, 0.0, 0.0, None)


async def process_trade_id(session: AsyncSession, redis: Redis, trade_id: str) -> bool:
  trade = (await session.execute(select(TradeRaw).where(TradeRaw.trade_id == trade_id))).scalars().first()
  if not trade:
    logger.warning(f"trade_not_found trade_id={trade_id}")
    return False

  has_positions, has_action_type_col, has_profiles, has_trade_history, _ = await _ensure_schema_flags(session)

  wallet = trade.wallet
  now = datetime.now(timezone.utc)

  await session.execute(
    insert(Wallet)
    .values(address=wallet, first_seen_at=now, last_seen_at=now)
    .on_conflict_do_update(index_elements=[Wallet.address], set_={"last_seen_at": now})
  )

  score = await compute_whale_score(session, wallet)

  await session.execute(
    insert(WhaleScore)
    .values(wallet_address=wallet, final_score=score, updated_at=now)
    .on_conflict_do_update(index_elements=[WhaleScore.wallet_address], set_={"final_score": score, "updated_at": now})
  )

  trade_usd = _usd(trade)

  recent_since = now - timedelta(minutes=20)
  recent = (
    await session.execute(
      select(TradeRaw)
      .where(TradeRaw.wallet == wallet)
      .where(TradeRaw.market_id == trade.market_id)
      .where(TradeRaw.timestamp >= recent_since)
      .order_by(TradeRaw.timestamp.asc())
    )
  ).scalars().all()

  behavior, score_hint, agg_amount, agg_price, behavior_side = detect_behavior(recent, now)
  if score_hint:
    score = max(score, score_hint)

  qualifies = (score >= 90 and trade_usd >= 500) or (score >= 75 and trade_usd >= 3000) or bool(score_hint)
  if not qualifies:
    return False

  event_side = behavior_side or str(trade.side)
  event_amount = agg_amount if score_hint else float(trade.amount)
  event_price = agg_price if score_hint else float(trade.price)
  event_trade_usd = float(event_amount) * float(event_price)

  action_type = "entry" if (event_side or "").lower() != "sell" else "exit"
  realized_pnl = 0.0
  if has_positions:
    pos = (
      await session.execute(
        select(WhalePosition).where(WhalePosition.wallet_address == wallet).where(WhalePosition.market_id == trade.market_id)
      )
    ).scalars().first()
    prev_size = float(pos.net_size) if pos and pos.net_size is not None else 0.0
    prev_avg = float(pos.avg_price) if pos and pos.avg_price is not None else 0.0
    update = _apply_trade_to_position(prev_size, prev_avg, event_side, event_amount, event_price)
    action_type = update.action_type
    realized_pnl = update.realized_pnl
    new_size = update.new_size
    new_avg = update.new_avg

    if pos is None:
      pos = WhalePosition(
        wallet_address=wallet,
        market_id=trade.market_id,
        net_size=new_size,
        avg_price=new_avg,
        updated_at=now,
      )
      session.add(pos)
    else:
      pos.net_size = new_size
      pos.avg_price = new_avg
      pos.updated_at = now

  if has_trade_history:
    try:
      await session.execute(
        insert(WhaleTradeHistory)
        .values(
          trade_id=trade_id,
          wallet_address=wallet,
          market_id=trade.market_id,
          side=str(event_side or trade.side),
          price=event_price,
          size=event_amount,
          pnl=realized_pnl,
          trade_usd=event_trade_usd,
          timestamp=trade.timestamp,
        )
        .on_conflict_do_nothing(index_elements=[WhaleTradeHistory.trade_id])
      )
    except Exception:
      pass

  wt_id = _id(trade_id)
  whale_trade_values: dict[str, object] = {
    "id": wt_id,
    "trade_id": trade_id,
    "wallet_address": wallet,
    "whale_score": score,
    "market_id": trade.market_id,
    "created_at": now,
  }
  if has_action_type_col:
    whale_trade_values["action_type"] = action_type
  result = await session.execute(
    insert(WhaleTrade)
    .values(**whale_trade_values)
    .on_conflict_do_nothing(index_elements=[WhaleTrade.trade_id])
  )
  created = result.rowcount == 1
  if created:
    if has_profiles:
      try:
        wins_inc = 1 if realized_pnl > 0 else 0
        losses_inc = 1 if realized_pnl < 0 else 0
        await session.execute(
          insert(WhaleProfile)
          .values(
            wallet_address=wallet,
            total_volume=event_trade_usd,
            total_trades=1,
            realized_pnl=realized_pnl,
            wins=wins_inc,
            losses=losses_inc,
            updated_at=now,
          )
          .on_conflict_do_update(
            index_elements=[WhaleProfile.wallet_address],
            set_={
              "total_volume": WhaleProfile.total_volume + event_trade_usd,
              "total_trades": WhaleProfile.total_trades + 1,
              "realized_pnl": WhaleProfile.realized_pnl + realized_pnl,
              "wins": WhaleProfile.wins + wins_inc,
              "losses": WhaleProfile.losses + losses_inc,
              "updated_at": now,
            },
          )
        )
      except Exception:
        pass
    await redis.rpush(
      settings.whale_trade_created_queue,
      json.dumps(
        {
          "whale_trade_id": wt_id,
          "trade_id": trade_id,
          "market_id": trade.market_id,
          "wallet_address": wallet,
          "whale_score": score,
          "action_type": action_type,
          "behavior": behavior,
          "side": event_side,
          "amount": event_amount,
          "price": event_price,
          "trade_usd": event_trade_usd,
          "created_at": now.isoformat(),
        }
      ),
    )
  return created


@dataclass(frozen=True)
class _WindowMetrics:
  trades: int
  win_rate: float
  roi: float
  total_pnl: float
  total_volume: float
  avg_trade_size: float
  max_drawdown: float
  stddev_pnl: float
  avg_entry_percentile: float
  avg_exit_percentile: float
  risk_reward_ratio: float
  market_liquidity_ratio: float
  top_market_fraction: float
  pnl_abs_ratio: float


def _clamp(x: float, lo: float, hi: float) -> float:
  if x < lo:
    return lo
  if x > hi:
    return hi
  return x


def _safe_float(x: object, default: float = 0.0) -> float:
  try:
    v = float(x)  # type: ignore[arg-type]
    if math.isfinite(v):
      return v
  except Exception:
    pass
  return float(default)


def _safe_int(x: object, default: int = 0) -> int:
  try:
    return int(x)  # type: ignore[arg-type]
  except Exception:
    return int(default)


def _score_roi(roi: float) -> float:
  r = float(roi)
  if r <= -0.5:
    return 0.0
  if r >= 0.5:
    return 100.0
  return _clamp((r + 0.5) / 1.0 * 100.0, 0.0, 100.0)


def _score_log(x: float, x_good: float) -> float:
  v = max(float(x), 0.0)
  g = max(float(x_good), 1.0)
  return _clamp((math.log10(v + 1.0) / math.log10(g + 1.0)) * 100.0, 0.0, 100.0)


def _score_rr(rr: float) -> float:
  r = max(float(rr), 0.0)
  if r <= 0:
    return 0.0
  if r >= 3.0:
    return 100.0
  return _clamp((r / 3.0) * 100.0, 0.0, 100.0)


def _compute_scores(m: _WindowMetrics, wallet_age_days: float, wash_suspected: bool) -> dict[str, float]:
  trades = max(int(m.trades), 0)
  win_rate = _clamp(float(m.win_rate), 0.0, 1.0)
  roi = float(m.roi)
  performance = 0.7 * _score_roi(roi) + 0.3 * (win_rate * 100.0)

  mean_abs_pnl = abs(float(m.total_pnl)) / max(float(trades), 1.0)
  vol = float(m.stddev_pnl) / (mean_abs_pnl + 1.0)
  vol_penalty = _clamp(vol * 15.0, 0.0, 60.0)
  consistency = _clamp((win_rate * 100.0) - vol_penalty, 0.0, 100.0)

  entry_q = (1.0 - _clamp(float(m.avg_entry_percentile), 0.0, 1.0)) * 100.0
  exit_q = _clamp(float(m.avg_exit_percentile), 0.0, 1.0) * 100.0
  timing = _clamp((entry_q + exit_q) / 2.0, 0.0, 100.0)

  dd_ratio = abs(float(m.max_drawdown)) / max(float(m.total_volume), 1.0)
  dd_score = 100.0 - _clamp((dd_ratio / 0.5) * 100.0, 0.0, 100.0)
  risk = _clamp(0.7 * dd_score + 0.3 * _score_rr(float(m.risk_reward_ratio)), 0.0, 100.0)

  size_score = _score_log(float(m.avg_trade_size), 10_000.0)
  liq_score = _clamp((float(m.market_liquidity_ratio) / 0.05) * 100.0, 0.0, 100.0)
  impact = _clamp(0.5 * size_score + 0.5 * liq_score, 0.0, 100.0)

  if trades < 5:
    performance *= 0.75
    consistency *= 0.75
    timing *= 0.85
    risk *= 0.85
    impact *= 0.75

  if wallet_age_days < 7:
    age_mult = 0.4
  elif wallet_age_days < 14:
    age_mult = 0.7
  else:
    age_mult = 1.0

  if wash_suspected:
    age_mult *= 0.2

  performance = _clamp(performance, 0.0, 100.0)
  consistency = _clamp(consistency, 0.0, 100.0)
  timing = _clamp(timing, 0.0, 100.0)
  risk = _clamp(risk, 0.0, 100.0)
  impact = _clamp(impact, 0.0, 100.0)

  whale_score = (
    0.30 * performance +
    0.25 * consistency +
    0.20 * timing +
    0.15 * risk +
    0.10 * impact
  ) * age_mult

  return {
    "whale_score": float(_clamp(whale_score, 0.0, 100.0)),
    "performance_score": float(performance),
    "consistency_score": float(consistency),
    "timing_score": float(timing),
    "risk_score": float(risk),
    "impact_score": float(impact),
  }


@dataclass(frozen=True)
class _CombinedMetrics:
  trades: int
  win_rate: float
  roi: float
  total_pnl: float
  total_volume: float
  avg_trade_size: float
  max_drawdown: float
  stddev_pnl: float
  avg_entry_percentile: float
  avg_exit_percentile: float
  risk_reward_ratio: float
  market_liquidity_ratio: float
  top_market_fraction: float
  pnl_abs_ratio: float


def _combine_window_metrics(m7: _WindowMetrics | None, m30: _WindowMetrics | None, m90: _WindowMetrics | None) -> _CombinedMetrics:
  parts: list[tuple[float, _WindowMetrics]] = []
  if m7 and m7.trades >= 3:
    parts.append((0.2, m7))
  if m30 and m30.trades >= 3:
    parts.append((0.4, m30))
  if m90 and m90.trades >= 3:
    parts.append((0.4, m90))

  if not parts:
    return _CombinedMetrics(
      trades=0,
      win_rate=0.0,
      roi=0.0,
      total_pnl=0.0,
      total_volume=0.0,
      avg_trade_size=0.0,
      max_drawdown=0.0,
      stddev_pnl=0.0,
      avg_entry_percentile=0.5,
      avg_exit_percentile=0.5,
      risk_reward_ratio=0.0,
      market_liquidity_ratio=0.0,
      top_market_fraction=0.0,
      pnl_abs_ratio=0.0,
    )

  wsum = sum(w for w, _ in parts)
  weights = [(w / wsum, m) for w, m in parts]

  def wavg(getter, default: float) -> float:
    out = 0.0
    for w, m in weights:
      out += w * float(getter(m))
    if not math.isfinite(out):
      return float(default)
    return float(out)

  trades = int(round(sum(w * m.trades for w, m in weights)))
  return _CombinedMetrics(
    trades=trades,
    win_rate=_clamp(wavg(lambda m: m.win_rate, 0.0), 0.0, 1.0),
    roi=wavg(lambda m: m.roi, 0.0),
    total_pnl=wavg(lambda m: m.total_pnl, 0.0),
    total_volume=max(wavg(lambda m: m.total_volume, 0.0), 0.0),
    avg_trade_size=max(wavg(lambda m: m.avg_trade_size, 0.0), 0.0),
    max_drawdown=max(wavg(lambda m: m.max_drawdown, 0.0), 0.0),
    stddev_pnl=max(wavg(lambda m: m.stddev_pnl, 0.0), 0.0),
    avg_entry_percentile=_clamp(wavg(lambda m: m.avg_entry_percentile, 0.5), 0.0, 1.0),
    avg_exit_percentile=_clamp(wavg(lambda m: m.avg_exit_percentile, 0.5), 0.0, 1.0),
    risk_reward_ratio=max(wavg(lambda m: m.risk_reward_ratio, 0.0), 0.0),
    market_liquidity_ratio=max(wavg(lambda m: m.market_liquidity_ratio, 0.0), 0.0),
    top_market_fraction=_clamp(wavg(lambda m: m.top_market_fraction, 0.0), 0.0, 1.0),
    pnl_abs_ratio=max(wavg(lambda m: m.pnl_abs_ratio, 0.0), 0.0),
  )


async def _fetch_window_metrics(session: AsyncSession, *, since: datetime, trade_cap: int) -> dict[str, _WindowMetrics]:
  q = text(
    """
    with base as (
      select
        wth.trade_id,
        wth.wallet_address,
        wth.market_id,
        wth.side,
        wth.timestamp,
        (wth.pnl)::double precision as pnl,
        (wth.trade_usd)::double precision as trade_usd,
        row_number() over (partition by wth.wallet_address order by wth.timestamp desc) as rn
      from whale_trade_history wth
      where wth.timestamp >= :since
    ),
    limited as (
      select * from base where rn <= :trade_cap
    ),
    agg as (
      select
        wallet_address,
        count(*)::int as trades,
        coalesce(sum(pnl), 0.0) as total_pnl,
        coalesce(sum(trade_usd), 0.0) as total_volume,
        coalesce(avg(trade_usd), 0.0) as avg_trade_size,
        coalesce(stddev_pop(pnl), 0.0) as stddev_pnl,
        (sum(case when pnl > 0 then 1 else 0 end)::double precision / nullif(count(*), 0)) as win_rate,
        coalesce(avg(case when pnl > 0 then pnl end), 0.0) as avg_win,
        coalesce(avg(case when pnl < 0 then abs(pnl) end), 0.0) as avg_loss
      from limited
      group by wallet_address
    ),
    cum as (
      select
        wallet_address,
        timestamp,
        sum(pnl) over (partition by wallet_address order by timestamp asc rows between unbounded preceding and current row) as cum_pnl
      from limited
    ),
    dd as (
      select
        wallet_address,
        coalesce(max(running_max - cum_pnl), 0.0) as max_drawdown
      from (
        select
          wallet_address,
          cum_pnl,
          max(cum_pnl) over (partition by wallet_address order by timestamp asc rows between unbounded preceding and current row) as running_max
        from cum
      ) t
      group by wallet_address
    ),
    tr as (
      select
        trade_id,
        market_id,
        percent_rank() over (partition by market_id order by price asc) as pr
      from trades_raw
      where timestamp >= :since
    ),
    timing as (
      select
        l.wallet_address,
        coalesce(avg(case when lower(l.side) = 'buy' then tr.pr end), 0.5) as avg_entry_percentile,
        coalesce(avg(case when lower(l.side) = 'sell' then tr.pr end), 0.5) as avg_exit_percentile
      from limited l
      join tr on tr.trade_id = l.trade_id
      group by l.wallet_address
    ),
    market_vol as (
      select market_id, coalesce(sum(amount * price), 0)::double precision as market_volume
      from trades_raw
      where timestamp >= :since
      group by market_id
    ),
    impact as (
      select
        l.wallet_address,
        coalesce(avg(l.trade_usd / nullif(m.market_volume, 0.0)), 0.0) as market_liquidity_ratio
      from limited l
      join market_vol m on m.market_id = l.market_id
      group by l.wallet_address
    ),
    market_counts as (
      select wallet_address, market_id, count(*)::int as cnt
      from limited
      group by wallet_address, market_id
    ),
    top_market as (
      select wallet_address, max(cnt)::double precision as top_cnt
      from market_counts
      group by wallet_address
    )
    select
      a.wallet_address,
      a.trades,
      a.total_pnl,
      a.total_volume,
      a.avg_trade_size,
      coalesce(d.max_drawdown, 0.0) as max_drawdown,
      a.stddev_pnl,
      coalesce(t.avg_entry_percentile, 0.5) as avg_entry_percentile,
      coalesce(t.avg_exit_percentile, 0.5) as avg_exit_percentile,
      coalesce(a.total_pnl / nullif(a.total_volume, 0.0), 0.0) as roi,
      coalesce(a.avg_win / nullif(a.avg_loss, 0.0), 0.0) as risk_reward_ratio,
      coalesce(i.market_liquidity_ratio, 0.0) as market_liquidity_ratio,
      coalesce(tm.top_cnt / nullif(a.trades::double precision, 0.0), 0.0) as top_market_fraction,
      coalesce(abs(a.total_pnl) / nullif(a.total_volume, 0.0), 0.0) as pnl_abs_ratio,
      coalesce(a.win_rate, 0.0) as win_rate
    from agg a
    left join dd d on d.wallet_address = a.wallet_address
    left join timing t on t.wallet_address = a.wallet_address
    left join impact i on i.wallet_address = a.wallet_address
    left join top_market tm on tm.wallet_address = a.wallet_address
    """
  )
  rows = (await session.execute(q, {"since": since, "trade_cap": trade_cap})).mappings().all()
  out: dict[str, _WindowMetrics] = {}
  for r in rows:
    addr = str(r.get("wallet_address") or "")
    if not addr:
      continue
    out[addr] = _WindowMetrics(
      trades=_safe_int(r.get("trades"), 0),
      win_rate=_safe_float(r.get("win_rate"), 0.0),
      roi=_safe_float(r.get("roi"), 0.0),
      total_pnl=_safe_float(r.get("total_pnl"), 0.0),
      total_volume=_safe_float(r.get("total_volume"), 0.0),
      avg_trade_size=_safe_float(r.get("avg_trade_size"), 0.0),
      max_drawdown=_safe_float(r.get("max_drawdown"), 0.0),
      stddev_pnl=_safe_float(r.get("stddev_pnl"), 0.0),
      avg_entry_percentile=_safe_float(r.get("avg_entry_percentile"), 0.5),
      avg_exit_percentile=_safe_float(r.get("avg_exit_percentile"), 0.5),
      risk_reward_ratio=_safe_float(r.get("risk_reward_ratio"), 0.0),
      market_liquidity_ratio=_safe_float(r.get("market_liquidity_ratio"), 0.0),
      top_market_fraction=_safe_float(r.get("top_market_fraction"), 0.0),
      pnl_abs_ratio=_safe_float(r.get("pnl_abs_ratio"), 0.0),
    )
  return out


async def recompute_whale_stats(session: AsyncSession, *, trade_cap: int = 30) -> int:
  now = datetime.now(timezone.utc)
  _, _, _, has_trade_history, has_stats = await _ensure_schema_flags(session)
  if not has_trade_history or not has_stats:
    return 0

  since7 = now - timedelta(days=7)
  since30 = now - timedelta(days=30)
  since90 = now - timedelta(days=90)

  m7 = await _fetch_window_metrics(session, since=since7, trade_cap=trade_cap)
  m30 = await _fetch_window_metrics(session, since=since30, trade_cap=trade_cap)
  m90 = await _fetch_window_metrics(session, since=since90, trade_cap=trade_cap)

  wallets = set(m7.keys()) | set(m30.keys()) | set(m90.keys())
  if not wallets:
    return 0

  age_rows = (
    await session.execute(
      select(Wallet.address, Wallet.first_seen_at).where(Wallet.address.in_(list(wallets)))
    )
  ).all()
  first_seen_map: dict[str, datetime | None] = {str(a): fs for a, fs in age_rows}

  def wallet_age_days(addr: str) -> float:
    fs = first_seen_map.get(addr)
    if not fs:
      return 0.0
    try:
      d = (now - fs).total_seconds() / 86400.0
      return float(max(d, 0.0))
    except Exception:
      return 0.0

  values: list[dict[str, object]] = []
  for addr in wallets:
    w7 = m7.get(addr)
    w30 = m30.get(addr)
    w90 = m90.get(addr)
    combined = _combine_window_metrics(w7, w30, w90)

    wash = False
    for w in (w30, w90):
      if not w:
        continue
      if w.trades >= 10 and w.top_market_fraction >= 0.8 and w.pnl_abs_ratio <= 0.01:
        wash = True
        break

    scores = _compute_scores(
      _WindowMetrics(
        trades=combined.trades,
        win_rate=combined.win_rate,
        roi=combined.roi,
        total_pnl=combined.total_pnl,
        total_volume=combined.total_volume,
        avg_trade_size=combined.avg_trade_size,
        max_drawdown=combined.max_drawdown,
        stddev_pnl=combined.stddev_pnl,
        avg_entry_percentile=combined.avg_entry_percentile,
        avg_exit_percentile=combined.avg_exit_percentile,
        risk_reward_ratio=combined.risk_reward_ratio,
        market_liquidity_ratio=combined.market_liquidity_ratio,
        top_market_fraction=combined.top_market_fraction,
        pnl_abs_ratio=combined.pnl_abs_ratio,
      ),
      wallet_age_days(addr),
      wash,
    )

    whale_score = int(round(scores["whale_score"]))
    values.append(
      {
        "wallet_address": addr,
        "whale_score": whale_score,
        "performance_score": float(scores["performance_score"]),
        "consistency_score": float(scores["consistency_score"]),
        "timing_score": float(scores["timing_score"]),
        "risk_score": float(scores["risk_score"]),
        "impact_score": float(scores["impact_score"]),
        "win_rate": float(combined.win_rate),
        "roi": float(combined.roi),
        "total_pnl": float(combined.total_pnl),
        "avg_trade_size": float(combined.avg_trade_size),
        "max_drawdown": float(combined.max_drawdown),
        "stddev_pnl": float(combined.stddev_pnl),
        "avg_entry_percentile": float(combined.avg_entry_percentile),
        "avg_exit_percentile": float(combined.avg_exit_percentile),
        "risk_reward_ratio": float(combined.risk_reward_ratio),
        "market_liquidity_ratio": float(combined.market_liquidity_ratio),
        "updated_at": now,
      }
    )

  if not values:
    return 0

  stmt = insert(WhaleStats).values(values)
  update_cols = {
    "whale_score": stmt.excluded.whale_score,
    "performance_score": stmt.excluded.performance_score,
    "consistency_score": stmt.excluded.consistency_score,
    "timing_score": stmt.excluded.timing_score,
    "risk_score": stmt.excluded.risk_score,
    "impact_score": stmt.excluded.impact_score,
    "win_rate": stmt.excluded.win_rate,
    "roi": stmt.excluded.roi,
    "total_pnl": stmt.excluded.total_pnl,
    "avg_trade_size": stmt.excluded.avg_trade_size,
    "max_drawdown": stmt.excluded.max_drawdown,
    "stddev_pnl": stmt.excluded.stddev_pnl,
    "avg_entry_percentile": stmt.excluded.avg_entry_percentile,
    "avg_exit_percentile": stmt.excluded.avg_exit_percentile,
    "risk_reward_ratio": stmt.excluded.risk_reward_ratio,
    "market_liquidity_ratio": stmt.excluded.market_liquidity_ratio,
    "updated_at": now,
  }
  await session.execute(
    stmt.on_conflict_do_update(index_elements=[WhaleStats.wallet_address], set_=update_cols)
  )

  score_values = [{"wallet_address": v["wallet_address"], "final_score": v["whale_score"], "updated_at": now} for v in values]
  score_stmt = insert(WhaleScore).values(score_values)
  await session.execute(
    score_stmt.on_conflict_do_update(
      index_elements=[WhaleScore.wallet_address],
      set_={"final_score": score_stmt.excluded.final_score, "updated_at": now},
    )
  )

  return len(values)
