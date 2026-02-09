import asyncio
import sys
import os

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import select
from shared.db import SessionLocal
from shared.models import TradeRaw, WhaleTradeHistory
from services.whale_engine.engine import process_trade_id

class MockRedis:
    async def rpush(self, *args, **kwargs):
        pass

async def process_trades():
    async with SessionLocal() as session:
        print("Fetching unprocessed trades...")
        
        # Fetch unprocessed trades ordered by timestamp
        stmt = (
            select(TradeRaw.trade_id)
            .outerjoin(WhaleTradeHistory, TradeRaw.trade_id == WhaleTradeHistory.trade_id)
            .where(WhaleTradeHistory.trade_id == None)
            .order_by(TradeRaw.timestamp.asc())
        )
        result = await session.execute(stmt)
        to_process = result.scalars().all()
        
        print(f"Found {len(to_process)} trades to process.")
        
        mock_redis = MockRedis()
        
        count = 0
        for trade_id in to_process:
            try:
                # process_trade_id commits internally or relies on session commit? 
                # It executes inserts but doesn't commit.
                await process_trade_id(session, mock_redis, trade_id)
                count += 1
                if count % 10 == 0:
                    print(f"Processed {count} trades...")
                    await session.commit() # Commit periodically
            except Exception as e:
                print(f"Error processing {trade_id}: {e}")
                import traceback
                traceback.print_exc()
        
        await session.commit()
        print(f"Finished processing {count} trades.")

if __name__ == "__main__":
    asyncio.run(process_trades())
