"""Clean historical health-check pollution from the production dataset.

The legacy multi-service health check injected a synthetic trade
(market_id='health-market', trade_id='health-test-<ts>', wallet
0xabc1234567890defabc1234567890defabc12345) into the pipeline every hour.
Those rows polluted trades_raw, whale_trades, whale_trade_history, alerts,
deliveries and whale_positions.

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


async def _count(session, stmt) -> int:
    return int((await session.execute(select(func.count()).select_from(stmt.subquery()))).scalar() or 0)


async def main() -> None:
    apply = "--apply" in sys.argv

    async with SessionLocal() as session:
        # 1) Identify polluted whale_trade ids (join whale_trades -> trades_raw).
        wt_subq = (
            select(WhaleTrade.id)
            .join(TradeRaw, TradeRaw.trade_id == WhaleTrade.trade_id)
            .where(
                (TradeRaw.market_id == "health-market")
                | (TradeRaw.trade_id.like("health-test-%"))
            )
        ).subquery()

        raw_ids = (
            select(TradeRaw.trade_id)
            .where((TradeRaw.market_id == "health-market") | (TradeRaw.trade_id.like("health-test-%")))
        ).subquery()

        counts = {
            "trades_raw": await _count(session, select(TradeRaw.trade_id).where(TradeRaw.trade_id.in_(select(raw_ids)))),
            "whale_trades": await _count(session, select(WhaleTrade.id).where(WhaleTrade.id.in_(select(wt_subq)))),
            "whale_trade_history": await _count(session, select(WhaleTradeHistory.trade_id).where(WhaleTradeHistory.trade_id.in_(select(raw_ids)))),
            "alerts": await _count(session, select(Alert.id).where(Alert.whale_trade_id.in_(select(wt_subq)))),
            "deliveries": await _count(session, select(Delivery.id).where(Delivery.whale_trade_id.in_(select(wt_subq)))),
            "whale_positions": await _count(session, select(WhalePosition.wallet_address).where(WhalePosition.market_id == "health-market")),
        }
        fake_wallet_rows = {
            "whale_profiles": await _count(session, select(WhaleProfile.wallet_address).where(WhaleProfile.wallet_address == FAKE_WALLET)),
            "whale_stats": await _count(session, select(WhaleStats.wallet_address).where(WhaleStats.wallet_address == FAKE_WALLET)),
            "whale_scores": await _count(session, select(WhaleScore.wallet_address).where(WhaleScore.wallet_address == FAKE_WALLET)),
        }

        total = sum(counts.values()) + sum(fake_wallet_rows.values())
        print("health-check pollution found:")
        for k, v in {**counts, **fake_wallet_rows}.items():
            print(f"  {k}: {v}")
        print(f"  TOTAL: {total}")

        if not apply:
            print("\nDRY RUN — pass --apply to delete.")
            return

        # Delete in dependency order.
        await session.execute(delete(Delivery).where(Delivery.whale_trade_id.in_(select(wt_subq))))
        await session.execute(delete(Alert).where(Alert.whale_trade_id.in_(select(wt_subq))))
        await session.execute(delete(WhaleTradeHistory).where(WhaleTradeHistory.trade_id.in_(select(raw_ids))))
        await session.execute(delete(WhaleTrade).where(WhaleTrade.id.in_(select(wt_subq))))
        await session.execute(delete(TradeRaw).where(TradeRaw.trade_id.in_(select(raw_ids))))
        await session.execute(delete(WhalePosition).where(WhalePosition.market_id == "health-market"))

        # Fake wallet aggregates (only the fake wallet; scores/stats may also be
        # recomputed for real wallets — never touch those).
        for model in (WhaleProfile, WhaleStats, WhaleScore):
            await session.execute(delete(model).where(model.wallet_address == FAKE_WALLET))

        await session.commit()
        print(f"\nDeleted {total} rows and committed.")


if __name__ == "__main__":
    asyncio.run(main())
