import argparse
import asyncio
import logging
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select

from shared.db import SessionLocal
from shared.logging import configure_logging
from shared.models import TradeRaw, WhaleTradeHistory
from services.whale_engine.engine import _apply_trade_to_position, recompute_whale_stats
from shared.db import insert

configure_logging("INFO")
logger = logging.getLogger(__name__)


def _normalize_wallet(value: str) -> str:
  return (value or "").strip().lower()


async def backfill_trade_history(wallet: str, since_days: int, limit: int, recompute_stats: bool) -> int:
  now = datetime.now(timezone.utc)
  since = None
  if since_days > 0:
    since = now - timedelta(days=since_days)

  positions: dict[tuple[str, str], tuple[float, float]] = {}
  inserted = 0

  async with SessionLocal() as session:
    query = select(TradeRaw).order_by(TradeRaw.timestamp.asc())
    if wallet:
      query = query.where(TradeRaw.wallet == wallet)
    if since is not None:
      query = query.where(TradeRaw.timestamp >= since)
    if limit > 0:
      query = query.limit(limit)

    trades = (await session.execute(query)).scalars().all()
    for trade in trades:
      wa = _normalize_wallet(trade.wallet)
      mid = str(trade.market_id)
      key = (wa, mid)
      prev_size, prev_avg = positions.get(key, (0.0, 0.0))
      update = _apply_trade_to_position(prev_size, prev_avg, trade.side, trade.amount, trade.price)
      positions[key] = (update.new_size, update.new_avg)

      pnl = float(update.realized_pnl)
      trade_usd = float(trade.amount) * float(trade.price)
      stmt = (
        insert(WhaleTradeHistory)
        .values(
          trade_id=trade.trade_id,
          wallet_address=wa,
          market_id=mid,
          side=str(trade.side),
          price=float(trade.price),
          size=float(trade.amount),
          pnl=pnl,
          trade_usd=trade_usd,
          timestamp=trade.timestamp,
        )
        .on_conflict_do_update(
          index_elements=[WhaleTradeHistory.trade_id],
          set_={
            "wallet_address": wa,
            "market_id": mid,
            "side": str(trade.side),
            "price": float(trade.price),
            "size": float(trade.amount),
            "pnl": pnl,
            "trade_usd": trade_usd,
            "timestamp": trade.timestamp,
          },
        )
      )
      await session.execute(stmt)
      inserted += 1

    if recompute_stats:
      await recompute_whale_stats(session)

    await session.commit()

  return inserted


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(description="Backfill whale_trade_history from trades_raw.")
  parser.add_argument("--wallet", default="", help="wallet address to backfill")
  parser.add_argument("--since-days", type=int, default=0, help="only include trades within N days")
  parser.add_argument("--limit", type=int, default=0, help="limit number of trades to backfill")
  parser.add_argument("--all", action="store_true", help="backfill all wallets")
  parser.add_argument("--no-recompute", action="store_true", help="skip recompute_whale_stats")
  return parser.parse_args()


async def main() -> None:
  args = parse_args()
  wallet = _normalize_wallet(args.wallet)
  if not wallet and not args.since_days and not args.all:
    raise SystemExit("Provide --wallet, --since-days, or --all to prevent full backfill by default.")

  count = await backfill_trade_history(wallet, args.since_days, args.limit, not args.no_recompute)
  logger.info(f"Backfill completed. Processed {count} trades.")
  print(f"✅ Backfill completed. Processed {count} trades.")


if __name__ == "__main__":
  asyncio.run(main())
