import asyncio
from sqlalchemy import select
from shared.db import get_session
from shared.models import WhaleTradeHistory

async def main():
    async for session in get_session():
        stmt = select(WhaleTradeHistory).where(WhaleTradeHistory.wallet_address.like("0xSniperWhale009%"))
        res = await session.execute(stmt)
        trades = res.scalars().all()
        print(f"Found {len(trades)} trades")
        for t in trades:
            print(f"ID={t.trade_id} Side={t.side} Size={t.size} Price={t.price} PnL={t.pnl}")

if __name__ == "__main__":
    asyncio.run(main())
