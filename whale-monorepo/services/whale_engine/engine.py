import hashlib
import json
from datetime import datetime, timedelta, timezone

from redis.asyncio import Redis
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from shared.config import settings
from shared.models import TradeRaw, Wallet, WhaleScore, WhaleTrade


def _id(trade_id: str) -> str:
  return hashlib.sha1(f"wt:{trade_id}".encode("utf-8")).hexdigest()[:32]


async def compute_whale_score(session: AsyncSession, wallet: str) -> int:
  now = datetime.now(timezone.utc)
  since = now - timedelta(days=30)
  total = (
    await session.execute(
      select(func.coalesce(func.sum(TradeRaw.amount * TradeRaw.price), 0)).where(TradeRaw.wallet == wallet).where(TradeRaw.timestamp >= since)
    )
  ).scalar_one()
  usd = float(total or 0)
  if usd >= 50000:
    return 95
  if usd >= 20000:
    return 88
  if usd >= 10000:
    return 80
  if usd >= 5000:
    return 70
  return 50


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
    return False

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

  wt_id = _id(trade_id)
  result = await session.execute(
    insert(WhaleTrade)
    .values(id=wt_id, trade_id=trade_id, wallet_address=wallet, whale_score=score, market_id=trade.market_id, created_at=now)
    .on_conflict_do_nothing(index_elements=[WhaleTrade.trade_id])
  )
  created = result.rowcount == 1
  if created:
    await redis.rpush(
      settings.whale_trade_created_queue,
      json.dumps(
        {
          "whale_trade_id": wt_id,
          "trade_id": trade_id,
          "market_id": trade.market_id,
          "wallet_address": wallet,
          "whale_score": score,
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
