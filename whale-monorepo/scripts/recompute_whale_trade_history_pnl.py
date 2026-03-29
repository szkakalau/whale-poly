import argparse
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from shared.db import SessionLocal
from shared.models import WhaleTradeHistory
from services.whale_engine.engine import _apply_trade_to_position, recompute_whale_stats


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Recompute pnl for existing whale_trade_history rows.")
    parser.add_argument("--wallet", default="", help="wallet address to recompute (optional)")
    parser.add_argument("--since-days", type=int, default=0, help="only include trades within N days")
    parser.add_argument("--no-recompute", action="store_true", help="skip recompute_whale_stats")
    return parser.parse_args()


def _normalize_wallet(value: str) -> str:
    return (value or "").strip().lower()


async def main() -> int:
    args = parse_args()
    wallet = _normalize_wallet(args.wallet)

    since = None
    if args.since_days > 0:
        since = datetime.now(timezone.utc) - timedelta(days=args.since_days)

    positions: dict[tuple[str, str], tuple[float, float]] = {}
    updated = 0

    async with SessionLocal() as session:
        query = select(WhaleTradeHistory).order_by(
            WhaleTradeHistory.wallet_address.asc(),
            WhaleTradeHistory.market_id.asc(),
            WhaleTradeHistory.timestamp.asc(),
        )
        if wallet:
            query = query.where(WhaleTradeHistory.wallet_address == wallet)
        if since is not None:
            query = query.where(WhaleTradeHistory.timestamp >= since)

        rows = (await session.execute(query)).scalars().all()

        for row in rows:
            wa = _normalize_wallet(row.wallet_address)
            mid = str(row.market_id)
            key = (wa, mid)
            prev_size, prev_avg = positions.get(key, (0.0, 0.0))

            side = str(row.side or "").strip().lower()
            amount = float(row.size or 0)
            price = float(row.price or 0)

            update = _apply_trade_to_position(prev_size, prev_avg, side, amount, price)
            positions[key] = (update.new_size, update.new_avg)

            pnl = float(update.realized_pnl)
            if float(row.pnl or 0) != pnl:
                row.pnl = pnl
                updated += 1

        if not args.no_recompute:
            await recompute_whale_stats(session)

        await session.commit()

    print(f"✅ Recomputed whale_trade_history pnl. Updated {updated} rows.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

