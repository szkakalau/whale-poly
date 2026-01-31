import asyncio
from shared.db import SessionLocal
from shared.models import WhaleTrade
from sqlalchemy import select

async def check():
    async with SessionLocal() as session:
        # Check for our test trade
        result = await session.execute(select(WhaleTrade).where(WhaleTrade.trade_id.like('MANUAL_TEST_%')))
        trades = result.scalars().all()
        print(f'Found {len(trades)} WhaleTrade entries for test trades:')
        for trade in trades:
            print(f'  - ID: {trade.id}, Trade ID: {trade.trade_id}, Whale Score: {trade.whale_score}, Wallet: {trade.wallet_address}')

if __name__ == "__main__":
    asyncio.run(check())