"""Clean historical health-check pollution from the production dataset.

The legacy multi-service health check injected a synthetic trade
(market_id='health-market', wallet 0xabc1234567890defabc1234567890defabc12345)
into the pipeline every hour. Those rows polluted trades_raw, whale_trades,
whale_trade_history, alerts, deliveries and whale_positions.

All injected trades share market_id='health-market' (indexed), so the lookup
is an index scan — do NOT add `trade_id LIKE 'health-test-%'`, which forces a
sequential scan over the multi-million-row trades_raw table and takes minutes
on the small instance.

Run once from a backend container (Render Shell / app):
    python scripts/cleanup_health_trades.py [--apply]

Without --apply it is a dry run and only prints what would be deleted.
"""
import asyncio
import sys

sys.path.insert(0, ".")

from sqlalchemy import delete, select, func

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


async def main() -> None:
    apply = "--apply" in sys.argv

    async with SessionLocal() as session:
        # 1) Raw trade ids — indexed market_id lookup only.
        raw_ids = list(
            (
                await session.execute(
                    select(TradeRaw.trade_id).where(TradeRaw.market_id == "health-market")
                )
            )
            .scalars()
            .all()
        )
        if not raw_ids:
            print("no health-market trades found — nothing to clean.")
            return

        # 2) Whale trade ids referencing those raw trades (PK join — fast).
        wt_ids = list(
            (
                await session.execute(
                    select(WhaleTrade.id).where(WhaleTrade.trade_id.in_(raw_ids))
                )
            )
            .scalars()
            .all()
        )

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


if __name__ == "__main__":
    asyncio.run(main())
