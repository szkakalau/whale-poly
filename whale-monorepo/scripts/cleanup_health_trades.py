"""Clean historical health-check pollution from the production dataset.

The legacy multi-service health check injected a synthetic trade
(market_id='health-market', wallet 0xabc1234567890defabc1234567890defabc12345)
into the pipeline every hour. Those rows polluted trades_raw, whale_trades,
whale_trade_history, alerts, deliveries and whale_positions.

PERFORMANCE NOTES (learned the hard way on the 0.1-CPU production instance):
- trades_raw has NO standalone market_id index and is ~9GB. `WHERE
  market_id = 'health-market'` on it is a full sequential scan that runs for
  minutes — never do that.
- Use ONLY indexed paths:
    * whale_trades (market_id, created_at) composite index
    * trades_raw (wallet, market_id, timestamp) composite index + fake wallet
- Every statement runs under `SET statement_timeout = '15s'` so a slow query
  fails fast instead of hanging the script.

Run once from a backend container (Render Shell / app):
    python scripts/cleanup_health_trades.py [--apply]

Without --apply it is a dry run and only prints what would be deleted.
"""
import asyncio
import sys

sys.path.insert(0, ".")

from sqlalchemy import delete, select, func, text

from shared.db import SessionLocal
from shared.models import (
    Alert,
    Delivery,
    TradeRaw,
    WhalePosition,
    WhaleProfile,
    WhaleScore,
    WhaleStats,
    WhaleTrade,
    WhaleTradeHistory,
)

FAKE_WALLET = "0xabc1234567890defabc1234567890defabc12345"
STATEMENT_TIMEOUT = "15s"


async def main() -> None:
    apply = "--apply" in sys.argv

    async with SessionLocal() as session:
        # Fail fast: no statement may exceed 15s on this tiny instance.
        await session.execute(text(f"SET statement_timeout = '{STATEMENT_TIMEOUT}'"))

        # 1) Indexed path A: whale_trades by market_id (composite index).
        wt_rows = (
            await session.execute(
                select(WhaleTrade.id, WhaleTrade.trade_id).where(
                    WhaleTrade.market_id == "health-market"
                )
            )
        ).all()
        wt_ids = [r.id for r in wt_rows]
        wt_trade_ids = [r.trade_id for r in wt_rows]

        # 2) Indexed path B: trades_raw via (wallet, market_id) composite index.
        raw_rows = (
            await session.execute(
                select(TradeRaw.trade_id).where(
                    TradeRaw.wallet == FAKE_WALLET, TradeRaw.market_id == "health-market"
                )
            )
        ).all()
        raw_ids = list(dict.fromkeys([r.trade_id for r in raw_rows] + wt_trade_ids))

        if not raw_ids and not wt_ids:
            print("no health-market pollution found — clean.")
            return

        async def _count(model, column, ids) -> int:
            if not ids:
                return 0
            return int(
                (
                    await session.execute(
                        select(func.count()).select_from(model).where(column.in_(ids))
                    )
                ).scalar()
                or 0
            )

        counts = {
            "trades_raw": len(raw_ids),
            "whale_trades": len(wt_ids),
            "whale_trade_history": await _count(
                WhaleTradeHistory, WhaleTradeHistory.trade_id, raw_ids
            ),
            "alerts": await _count(Alert, Alert.whale_trade_id, wt_ids),
            "deliveries": await _count(Delivery, Delivery.whale_trade_id, wt_ids),
        }
        counts["whale_positions"] = int(
            (
                await session.execute(
                    select(func.count())
                    .select_from(WhalePosition)
                    .where(WhalePosition.market_id == "health-market")
                )
            ).scalar()
            or 0
        )
        # Fake-wallet aggregates (only the fake wallet; never touch real ones).
        counts["whale_profiles"] = int(
            (
                await session.execute(
                    select(func.count())
                    .select_from(WhaleProfile)
                    .where(WhaleProfile.wallet_address == FAKE_WALLET)
                )
            ).scalar()
            or 0
        )
        counts["whale_stats"] = int(
            (
                await session.execute(
                    select(func.count())
                    .select_from(WhaleStats)
                    .where(WhaleStats.wallet_address == FAKE_WALLET)
                )
            ).scalar()
            or 0
        )
        counts["whale_scores"] = int(
            (
                await session.execute(
                    select(func.count())
                    .select_from(WhaleScore)
                    .where(WhaleScore.wallet_address == FAKE_WALLET)
                )
            ).scalar()
            or 0
        )

        total = sum(counts.values())
        print("health-check pollution found:")
        for k, v in counts.items():
            print(f"  {k}: {v}")
        print(f"  TOTAL: {total}")

        if not apply:
            print("\nDRY RUN — pass --apply to delete.")
            return

        # Delete in dependency order.
        if wt_ids:
            await session.execute(delete(Delivery).where(Delivery.whale_trade_id.in_(wt_ids)))
            await session.execute(delete(Alert).where(Alert.whale_trade_id.in_(wt_ids)))
        await session.execute(
            delete(WhaleTradeHistory).where(WhaleTradeHistory.trade_id.in_(raw_ids))
        )
        if wt_ids:
            await session.execute(delete(WhaleTrade).where(WhaleTrade.id.in_(wt_ids)))
        await session.execute(delete(TradeRaw).where(TradeRaw.trade_id.in_(raw_ids)))
        await session.execute(
            delete(WhalePosition).where(WhalePosition.market_id == "health-market")
        )
        for model in (WhaleProfile, WhaleStats, WhaleScore):
            await session.execute(delete(model).where(model.wallet_address == FAKE_WALLET))

        await session.commit()
        print(f"\nDeleted {total} rows and committed.")

        # Best-effort: remove the invalid half-built index from an earlier
        # aborted CONCURRENTLY build (harmless if it fails or times out).
        try:
            await session.execute(text("DROP INDEX IF EXISTS ix_trades_raw_market_id"))
            await session.commit()
            print("dropped invalid ix_trades_raw_market_id")
        except Exception:
            print("note: invalid ix_trades_raw_market_id still present (harmless) — drop later")


if __name__ == "__main__":
    asyncio.run(main())
