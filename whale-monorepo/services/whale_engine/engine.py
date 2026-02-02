import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone

from redis.asyncio import Redis
from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from shared.config import settings
from shared.models import TradeRaw, Wallet, WhaleScore, WhaleTrade, WhaleProfile, WhalePosition


logger = logging.getLogger("whale_engine.engine")

_HAS_WHALE_POSITIONS_TABLE: bool | None = None
_HAS_WHALE_TRADES_ACTION_TYPE_COLUMN: bool | None = None
_HAS_WHALE_PROFILES_TABLE: bool | None = None


async def _ensure_schema_flags(session: AsyncSession) -> tuple[bool, bool, bool]:
  global _HAS_WHALE_POSITIONS_TABLE, _HAS_WHALE_TRADES_ACTION_TYPE_COLUMN, _HAS_WHALE_PROFILES_TABLE

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

  return _HAS_WHALE_POSITIONS_TABLE, _HAS_WHALE_TRADES_ACTION_TYPE_COLUMN, _HAS_WHALE_PROFILES_TABLE


def _id(trade_id: str) -> str:
  return hashlib.sha1(f"wt:{trade_id}".encode("utf-8")).hexdigest()[:32]


async def compute_whale_score(session: AsyncSession, wallet: str) -> int:
  now = datetime.now(timezone.utc)
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

  _, _, has_profiles = await _ensure_schema_flags(session)
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

  has_positions, has_action_type_col, has_profiles = await _ensure_schema_flags(session)

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

  qualifies = (score >= 85) or (score >= 75 and trade_usd >= 1000) or bool(score_hint)
  if not qualifies:
    return False

  event_side = behavior_side or str(trade.side)
  event_amount = agg_amount if score_hint else float(trade.amount)
  event_price = agg_price if score_hint else float(trade.price)
  event_trade_usd = float(event_amount) * float(event_price)

  action_type = "entry" if (event_side or "").lower() != "sell" else "exit"
  if has_positions:
    pos = (
      await session.execute(
        select(WhalePosition).where(WhalePosition.wallet_address == wallet).where(WhalePosition.market_id == trade.market_id)
      )
    ).scalars().first()
    prev_size = float(pos.net_size) if pos and pos.net_size is not None else 0.0
    prev_avg = float(pos.avg_price) if pos and pos.avg_price is not None else 0.0

    side_norm = (event_side or "").lower()
    if side_norm == "buy":
      delta_size = event_amount
    elif side_norm == "sell":
      delta_size = -event_amount
    else:
      delta_size = 0.0

    new_size = prev_size + delta_size
    prev_notional = prev_size * prev_avg
    trade_notional = delta_size * event_price
    if abs(new_size) > 1e-9:
      new_avg = (prev_notional + trade_notional) / new_size
    else:
      new_avg = 0.0

    eps = 1e-9
    if abs(prev_size) < eps and abs(new_size) > eps:
      action_type = "entry"
    elif abs(prev_size) > eps and abs(new_size) < eps:
      action_type = "exit"
    elif prev_size * new_size > 0 and abs(new_size) > abs(prev_size):
      action_type = "add"
    elif prev_size * new_size > 0 and abs(new_size) < abs(prev_size):
      action_type = "reduce"
    else:
      action_type = "entry" if abs(new_size) > eps else "exit"

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
        await session.execute(
          insert(WhaleProfile)
          .values(
            wallet_address=wallet,
            total_volume=event_trade_usd,
            total_trades=1,
            realized_pnl=0,
            wins=0,
            losses=0,
            updated_at=now,
          )
          .on_conflict_do_update(
            index_elements=[WhaleProfile.wallet_address],
            set_={
              "total_volume": WhaleProfile.total_volume + event_trade_usd,
              "total_trades": WhaleProfile.total_trades + 1,
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
