
import asyncio
from sqlalchemy import select, func
from shared.db import SessionLocal
from shared.models import TradeRaw
from datetime import datetime, timezone, timedelta

async def check_db_stats():
    async with SessionLocal() as session:
        # Check total count
        count = (await session.execute(select(func.count(TradeRaw.trade_id)))).scalar()
        print(f"Total trades in DB: {count}")
        
        # Check last 1 hour
        hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        recent_count = (await session.execute(select(func.count(TradeRaw.trade_id)).where(TradeRaw.timestamp >= hour_ago))).scalar()
        print(f"Trades in last 1 hour: {recent_count}")
        
        if recent_count > 0:
            last_trade = (await session.execute(select(TradeRaw).order_by(TradeRaw.timestamp.desc()).limit(1))).scalars().first()
            print(f"Latest trade time: {last_trade.timestamp}")

if __name__ == "__main__":
    asyncio.run(check_db_stats())
