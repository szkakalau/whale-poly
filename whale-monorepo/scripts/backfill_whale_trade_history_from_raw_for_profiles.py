import argparse
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from shared.db import SessionLocal, insert
from shared.models import TradeRaw, WhaleProfile, WhaleTradeHistory
from services.whale_engine.engine import _apply_trade_to_position, recompute_whale_stats


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill whale_trade_history for whale_profiles wallets from trades_raw.")
    parser.add_argument("--since-days", type=int, default=0, help="only include trades within N days (0 = all)")
    parser.add_argument("--wallet-limit", type=int, default=0, help="limit number of wallets (0 = all)")
    parser.add_argument("--wallet-page-size", type=int, default=200, help="wallets per query page")
    parser.add_argument("--batch-size", type=int, default=1000, help="insert batch size")
    parser.add_argument("--commit-every", type=int, default=50000, help="commit every N processed trades")
    parser.add_argument("--no-recompute", action="store_true", help="skip recompute_whale_stats")
    return parser.parse_args()


def _normalize_wallet(value: str) -> str:
    return (value or "").strip().lower()


async def _flush_batch(session, batch: list[dict]) -> None:
    if not batch:
        return

    max_params = 32000
    cols = 9
    max_rows = max(1, max_params // cols)

    while batch:
        chunk = batch[:max_rows]
        del batch[:max_rows]

        stmt = insert(WhaleTradeHistory).values(chunk)
        stmt = stmt.on_conflict_do_update(
            index_elements=[WhaleTradeHistory.trade_id],
            set_={
                "wallet_address": stmt.excluded.wallet_address,
                "market_id": stmt.excluded.market_id,
                "side": stmt.excluded.side,
                "price": stmt.excluded.price,
                "size": stmt.excluded.size,
                "pnl": stmt.excluded.pnl,
                "trade_usd": stmt.excluded.trade_usd,
                "timestamp": stmt.excluded.timestamp,
            },
        )
        await session.execute(stmt)


async def main() -> int:
    args = parse_args()
    since = None
    if args.since_days > 0:
        since = datetime.now(timezone.utc) - timedelta(days=args.since_days)

    batch_size = max(int(args.batch_size), 1)
    wallet_limit = int(args.wallet_limit)
    commit_every = max(int(args.commit_every), 1)
    wallet_page_size = max(int(args.wallet_page_size), 1)

    async with SessionLocal() as session:
        wq = select(WhaleProfile.wallet_address).order_by(WhaleProfile.wallet_address.asc())
        if wallet_limit > 0:
            wq = wq.limit(wallet_limit)
        wallets = [str(w) for (w,) in (await session.execute(wq)).all()]

        total_trades = 0
        for i in range(0, len(wallets), wallet_page_size):
            page = wallets[i : i + wallet_page_size]
            tq = select(TradeRaw).where(TradeRaw.wallet.in_(page))
            if since is not None:
                tq = tq.where(TradeRaw.timestamp >= since)
            tq = tq.order_by(TradeRaw.wallet.asc(), TradeRaw.timestamp.asc())

            current_wallet: str | None = None
            positions: dict[str, tuple[float, float]] = {}
            batch: list[dict] = []

            stream = await session.stream_scalars(tq)
            async for t in stream:
                wa = str(t.wallet)
                if current_wallet is None:
                    current_wallet = wa
                elif wa != current_wallet:
                    await _flush_batch(session, batch)
                    await session.commit()
                    positions = {}
                    current_wallet = wa

                mid = str(t.market_id)
                prev_size, prev_avg = positions.get(mid, (0.0, 0.0))
                update = _apply_trade_to_position(prev_size, prev_avg, str(t.side), float(t.amount), float(t.price))
                positions[mid] = (update.new_size, update.new_avg)

                pnl = float(update.realized_pnl)
                trade_usd = float(t.amount) * float(t.price)
                batch.append(
                    {
                        "trade_id": str(t.trade_id),
                        "wallet_address": wa,
                        "market_id": mid,
                        "side": str(t.side),
                        "price": float(t.price),
                        "size": float(t.amount),
                        "pnl": pnl,
                        "trade_usd": trade_usd,
                        "timestamp": t.timestamp,
                    }
                )

                if len(batch) >= batch_size:
                    await _flush_batch(session, batch)

                total_trades += 1
                if total_trades % commit_every == 0:
                    await _flush_batch(session, batch)
                    await session.commit()
                    print(f"…processed {total_trades} trades")

            await _flush_batch(session, batch)
            await session.commit()
            print(f"…processed wallets {i + 1}-{min(i + wallet_page_size, len(wallets))} / {len(wallets)}")

        if not args.no_recompute:
            await recompute_whale_stats(session)
            await session.commit()

    print(f"✅ Backfilled whale_trade_history from trades_raw for whale_profiles wallets. Processed {total_trades} trades.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
