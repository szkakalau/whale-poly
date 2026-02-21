import hashlib
import json
import logging
import math
import os
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass

from redis.asyncio import Redis
from sqlalchemy import func, select, text, inspect
from sqlalchemy.ext.asyncio import AsyncSession

from shared.db import insert
from shared.config import settings, get_alert_config, parse_duration
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
    def check_tables(conn):
      inspector = inspect(conn.bind)
      tables = inspector.get_table_names()
      has_pos = "whale_positions" in tables
      has_prof = "whale_profiles" in tables
      has_hist = "whale_trade_history" in tables
      has_stats = "whale_stats" in tables
      
      print(f"DEBUG: Schema Check - tables={tables}")
      print(f"DEBUG: Schema Check - has_hist={has_hist}, has_stats={has_stats}")
      
      has_action = False
      if "whale_trades" in tables:
        cols = [c["name"] for c in inspector.get_columns("whale_trades")]
        has_action = "action_type" in cols
      
      return has_pos, has_prof, has_action, has_hist, has_stats

    try:
      (
        _HAS_WHALE_POSITIONS_TABLE,
        _HAS_WHALE_PROFILES_TABLE,
        _HAS_WHALE_TRADES_ACTION_TYPE_COLUMN,
        _HAS_WHALE_TRADE_HISTORY_TABLE,
        _HAS_WHALE_STATS_TABLE
      ) = await session.run_sync(check_tables)
    except Exception:
      _HAS_WHALE_POSITIONS_TABLE = False
      _HAS_WHALE_PROFILES_TABLE = False
      _HAS_WHALE_TRADES_ACTION_TYPE_COLUMN = False
      _HAS_WHALE_TRADE_HISTORY_TABLE = False
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
    except Exception as e:
      print(f"DEBUG: Error inserting WhaleTradeHistory: {e}")
      import traceback
      traceback.print_exc()
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
  if "SniperWhale009" in wallet:
      print(f"DEBUG: compute_whale_score {wallet} usd_30d={usd_30d}")

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


@dataclass(frozen=True)
class _CachedTrade:
  side: str
  amount: float
  price: float
  timestamp: datetime


async def _load_recent_trades(redis: Redis, wallet: str, market_id: str) -> list[_CachedTrade] | None:
  key = f"recent_trades:{wallet}:{market_id}"
  exists = await redis.exists(key)
  if not exists:
    return None
  raws = await redis.lrange(key, 0, -1)
  trades: list[_CachedTrade] = []
  for raw in raws:
    try:
      data = json.loads(raw)
    except Exception:
      continue
    ts_raw = data.get("timestamp")
    try:
      ts = datetime.fromisoformat(ts_raw)
    except Exception:
      continue
    if ts.tzinfo is None:
      ts = ts.replace(tzinfo=timezone.utc)
    trades.append(
      _CachedTrade(
        side=str(data.get("side") or ""),
        amount=float(data.get("amount") or 0),
        price=float(data.get("price") or 0),
        timestamp=ts,
      )
    )
  return trades


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


def detect_behavior(micro_trades: list[TradeRaw], macro_trades: list[TradeRaw], now: datetime) -> tuple[str | None, int, float, float, str | None]:
  def _to_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
      return dt.replace(tzinfo=timezone.utc)
    return dt

  config = get_alert_config()
  alert_thresholds = config.get("alert_thresholds", {})
  behavior_config = config.get("behavior_detection", {})
  spike_build_exit = alert_thresholds.get("spike_build_exit_thresholds", {})

  now_aware = _to_aware(now)
  micro_seconds = parse_duration(alert_thresholds.get("micro_window"), 20 * 60)
  macro_seconds = parse_duration(alert_thresholds.get("macro_window"), 6 * 60 * 60)
  micro_window = [t for t in micro_trades if (now_aware - _to_aware(t.timestamp)).total_seconds() <= micro_seconds]
  macro_window = [t for t in macro_trades if (now_aware - _to_aware(t.timestamp)).total_seconds() <= macro_seconds]
  buys_macro = [t for t in macro_window if (t.side or "").lower() == "buy"]
  sells_macro = [t for t in macro_window if (t.side or "").lower() == "sell"]

  spike_threshold = behavior_config.get("spike_threshold") or spike_build_exit.get("whale_entry") or settings.whale_single_trade_usd_threshold
  build_threshold = behavior_config.get("build_threshold") or spike_build_exit.get("whale_build") or settings.whale_build_usd_threshold
  exit_threshold = behavior_config.get("exit_threshold") or spike_build_exit.get("whale_exit") or settings.whale_exit_usd_threshold

  single_large = next((t for t in micro_window if _usd(t) >= float(spike_threshold)), None)
  if single_large:
    return ("spike", 80, float(single_large.amount), float(single_large.price), str(single_large.side))

  buy_val = sum(_usd(t) for t in buys_macro)
  sell_val = sum(_usd(t) for t in sells_macro)
  if len(buys_macro) >= 3 and buy_val >= float(build_threshold):
    total_amount = sum(float(t.amount) for t in buys_macro)
    avg_price = (buy_val / total_amount) if total_amount > 0 else 0.0
    return ("build", 75, total_amount, avg_price, "buy")

  buy_vol = sum(float(t.amount) for t in buys_macro)
  sell_vol = sum(float(t.amount) for t in sells_macro)
  if buy_vol > 0 and sell_vol >= 0.5 * buy_vol and sell_val >= float(exit_threshold):
    total_amount = sum(float(t.amount) for t in sells_macro)
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

  trade_usd = _usd(trade)
  score_key = f"trade_score:{trade_id}"
  cached_trade_score = await redis.get(score_key)
  if cached_trade_score is not None:
    try:
      score = int(float(cached_trade_score))
    except Exception:
      score = await compute_whale_score(session, wallet)
  else:
    cached_wallet_score = await redis.get(f"whale_score:{wallet}")
    if cached_wallet_score is not None:
      try:
        score = int(float(cached_wallet_score))
      except Exception:
        score = await compute_whale_score(session, wallet)
    else:
      score = await compute_whale_score(session, wallet)
      await redis.set(f"whale_score:{wallet}", str(score), ex=settings.whale_score_cache_seconds)
    await redis.set(score_key, str(score), ex=settings.trade_score_cache_seconds)
  if "SniperWhale009" in wallet:
      print(f"DEBUG: Wallet {wallet} score={score} trade_usd={trade_usd}")

  await session.execute(
    insert(WhaleScore)
    .values(wallet_address=wallet, final_score=score, updated_at=now)
    .on_conflict_do_update(index_elements=[WhaleScore.wallet_address], set_={"final_score": score, "updated_at": now})
  )

  config = get_alert_config()
  alert_thresholds = config.get("alert_thresholds", {})
  micro_seconds = parse_duration(alert_thresholds.get("micro_window"), 20 * 60)
  macro_seconds = parse_duration(alert_thresholds.get("macro_window"), 6 * 60 * 60)
  micro_since = now - timedelta(seconds=micro_seconds)
  macro_since = now - timedelta(seconds=macro_seconds)
  cached_recent = await _load_recent_trades(redis, wallet, trade.market_id)
  if cached_recent is not None:
    micro_recent = [t for t in cached_recent if t.timestamp >= micro_since]
    macro_recent = [t for t in cached_recent if t.timestamp >= macro_since]
  else:
    micro_recent = (
      await session.execute(
        select(TradeRaw)
        .where(TradeRaw.wallet == wallet)
        .where(TradeRaw.market_id == trade.market_id)
        .where(TradeRaw.timestamp >= micro_since)
        .order_by(TradeRaw.timestamp.asc())
      )
    ).scalars().all()
    macro_recent = (
      await session.execute(
        select(TradeRaw)
        .where(TradeRaw.wallet == wallet)
        .where(TradeRaw.market_id == trade.market_id)
        .where(TradeRaw.timestamp >= macro_since)
        .order_by(TradeRaw.timestamp.asc())
      )
    ).scalars().all()

  behavior, score_hint, agg_amount, agg_price, behavior_side = detect_behavior(micro_recent, macro_recent, now)
  if score_hint:
    score = max(score, score_hint)

  confidence_scores = alert_thresholds.get("confidence_scores", {})
  usd_thresholds = alert_thresholds.get("usd_thresholds", {})
  high_score = float(confidence_scores.get("high_confidence", 85))
  low_score = float(confidence_scores.get("low_confidence", 70))
  high_usd = float(usd_thresholds.get("high", 400))
  low_usd = float(usd_thresholds.get("low", 2500))
  high_signal = (score >= high_score and trade_usd >= high_usd) or bool(score_hint)
  low_signal = (not high_signal) and (score >= low_score and trade_usd >= low_usd)
  qualifies = high_signal or low_signal
  if "SniperWhale009" in wallet:
      print(f"DEBUG: Wallet {wallet} qualifies={qualifies} (score={score}, trade_usd={trade_usd})")
      print(f"DEBUG: has_trade_history={has_trade_history}")

  if not qualifies:
    return False

  event_side = behavior_side or str(trade.side)
  event_amount = agg_amount if score_hint else float(trade.amount)
  event_price = agg_price if score_hint else float(trade.price)
  event_trade_usd = float(event_amount) * float(event_price)
  signal_level = "high" if high_signal else "low"

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
    except Exception as e:
      print(f"DEBUG: Error inserting WhaleTradeHistory: {e}")
      import traceback
      traceback.print_exc()
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
          "outcome": trade.outcome,
          "side": event_side,
          "amount": event_amount,
          "price": event_price,
          "trade_usd": event_trade_usd,
          "signal_level": signal_level,
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
  raw_limit = int(os.getenv("WHALE_STATS_RAW_TRADE_CAP", "0"))
  tr_query = (
    select(TradeRaw.trade_id, TradeRaw.market_id, TradeRaw.price, TradeRaw.amount, TradeRaw.timestamp)
    .where(TradeRaw.timestamp >= since)
  )
  if raw_limit > 0:
    tr_query = tr_query.order_by(TradeRaw.timestamp.desc()).limit(raw_limit)
  tr_result = await session.execute(tr_query)
  raw_trades = tr_result.all()
  
  # Compute Market Volume and Price Percentiles
  market_volume: dict[str, float] = {}
  market_prices: dict[str, list[tuple[float, str]]] = {} # market_id -> list of (price, trade_id)
  
  for r in raw_trades:
    mid = str(r.market_id)
    vol = float(r.price) * float(r.amount)
    market_volume[mid] = market_volume.get(mid, 0.0) + vol
    if mid not in market_prices:
      market_prices[mid] = []
    market_prices[mid].append((float(r.price), str(r.trade_id)))
    
  trade_percentiles: dict[str, float] = {}
  for mid, items in market_prices.items():
    items.sort(key=lambda x: x[0])
    n = len(items)
    for idx, (price, tid) in enumerate(items):
      if n > 1:
        p = idx / (n - 1)
      else:
        p = 0.5
      trade_percentiles[tid] = p

  history_limit = int(os.getenv("WHALE_STATS_HISTORY_CAP", "0"))
  wth_query = (
    select(WhaleTradeHistory)
    .where(WhaleTradeHistory.timestamp >= since)
    .order_by(WhaleTradeHistory.wallet_address, WhaleTradeHistory.timestamp.desc())
  )
  if history_limit > 0:
    wth_query = wth_query.limit(history_limit)
  wth_result = await session.execute(wth_query)
  history_rows = wth_result.scalars().all()
  
  wallet_trades: dict[str, list[WhaleTradeHistory]] = {}
  for wth in history_rows:
    wa = str(wth.wallet_address)
    if wa not in wallet_trades:
      wallet_trades[wa] = []
    wallet_trades[wa].append(wth)
      
  out: dict[str, _WindowMetrics] = {}
  for wallet, trades in wallet_trades.items():
    trades = trades[:trade_cap]
    if not trades:
      continue
      
    n_trades = len(trades)
    total_pnl = sum(float(t.pnl) for t in trades)
    total_vol = sum(float(t.trade_usd) for t in trades)
    avg_trade_size = total_vol / n_trades if n_trades > 0 else 0.0
    
    pnls = [float(t.pnl) for t in trades]
    mean_pnl = total_pnl / n_trades if n_trades > 0 else 0.0
    
    if n_trades > 0:
      variance = sum((p - mean_pnl) ** 2 for p in pnls) / n_trades
      stddev_pnl = math.sqrt(variance)
    else:
      stddev_pnl = 0.0
      
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p < 0]
    
    # Calculate win rate based on closed trades (wins + losses)
    n_closed = len(wins) + len(losses)
    win_rate = len(wins) / n_closed if n_closed > 0 else 0.0
    
    avg_win = sum(wins) / len(wins) if wins else 0.0
    avg_loss = sum(abs(l) for l in losses) / len(losses) if losses else 0.0
    
    roi = total_pnl / total_vol if total_vol > 0 else 0.0
    risk_reward = avg_win / avg_loss if avg_loss > 0 else 0.0
    
    # Max Drawdown
    trades_asc = sorted(trades, key=lambda t: t.timestamp)
    current_cum = 0.0
    peak = -float('inf') 
    max_dd = 0.0
    
    # Initialize peak with first cum if needed, but logic:
    # running_max starts at -inf, updates as we go.
    # Actually if first cum is -100, peak becomes -100.
    
    for t in trades_asc:
      current_cum += float(t.pnl)
      if current_cum > peak:
        peak = current_cum
      dd = peak - current_cum
      if dd > max_dd:
        max_dd = dd
        
    entry_prs = []
    exit_prs = []
    liquidity_ratios = []
    market_counts: dict[str, int] = {}
    
    for t in trades:
      pr = trade_percentiles.get(t.trade_id, 0.5)
      side = str(t.side).lower()
      if side == 'buy':
        entry_prs.append(pr)
      elif side == 'sell':
        exit_prs.append(pr)
        
      m_vol = market_volume.get(t.market_id, 0.0)
      liq_ratio = float(t.trade_usd) / m_vol if m_vol > 0 else 0.0
      liquidity_ratios.append(liq_ratio)
      
      mid = str(t.market_id)
      market_counts[mid] = market_counts.get(mid, 0) + 1
      
    avg_entry = sum(entry_prs) / len(entry_prs) if entry_prs else 0.5
    avg_exit = sum(exit_prs) / len(exit_prs) if exit_prs else 0.5
    m_liq_ratio = sum(liquidity_ratios) / len(liquidity_ratios) if liquidity_ratios else 0.0
    
    top_cnt = max(market_counts.values()) if market_counts else 0
    top_frac = top_cnt / n_trades if n_trades > 0 else 0.0
    
    pnl_abs_ratio = abs(total_pnl) / total_vol if total_vol > 0 else 0.0
    
    out[wallet] = _WindowMetrics(
      trades=n_trades,
      win_rate=win_rate,
      roi=roi,
      total_pnl=total_pnl,
      total_volume=total_vol,
      avg_trade_size=avg_trade_size,
      max_drawdown=max_dd,
      stddev_pnl=stddev_pnl,
      avg_entry_percentile=avg_entry,
      avg_exit_percentile=avg_exit,
      risk_reward_ratio=risk_reward,
      market_liquidity_ratio=m_liq_ratio,
      top_market_fraction=top_frac,
      pnl_abs_ratio=pnl_abs_ratio,
    )
  return out


async def recompute_whale_stats(session: AsyncSession, *, trade_cap: int = 30) -> int:
  now = datetime.now(timezone.utc)
  _, _, _, has_trade_history, has_stats = await _ensure_schema_flags(session)
  if not has_trade_history or not has_stats:
    return 0

  trade_cap = int(os.getenv("WHALE_STATS_TRADE_CAP", str(trade_cap)))
  days7 = max(1, int(os.getenv("WHALE_STATS_DAYS_7", "7")))
  days30 = max(1, int(os.getenv("WHALE_STATS_DAYS_30", "30")))
  days90 = max(1, int(os.getenv("WHALE_STATS_DAYS_90", "90")))

  since7 = now - timedelta(days=days7)
  since30 = now - timedelta(days=days30)
  since90 = now - timedelta(days=days90)

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
  profile_values: list[dict[str, object]] = []
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

    wins = int(round(combined.trades * combined.win_rate))
    losses = max(0, combined.trades - wins)
    profile_values.append({
        "wallet_address": addr,
        "total_volume": float(combined.total_volume),
        "total_trades": int(combined.trades),
        "realized_pnl": float(combined.total_pnl),
        "wins": wins,
        "losses": losses,
        "updated_at": now,
    })

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

  if profile_values:
    profile_stmt = insert(WhaleProfile).values(profile_values)
    profile_update_cols = {
        "total_volume": profile_stmt.excluded.total_volume,
        "total_trades": profile_stmt.excluded.total_trades,
        "realized_pnl": profile_stmt.excluded.realized_pnl,
        "wins": profile_stmt.excluded.wins,
        "losses": profile_stmt.excluded.losses,
        "updated_at": now,
    }
    await session.execute(
        profile_stmt.on_conflict_do_update(
            index_elements=[WhaleProfile.wallet_address],
            set_=profile_update_cols
        )
    )

  return len(values)
