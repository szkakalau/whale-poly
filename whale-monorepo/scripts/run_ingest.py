
import asyncio
import sys
import os
import logging

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from shared.db import SessionLocal
from services.trade_ingest.polymarket import ingest_trades
from shared.logging import configure_logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def run_ingest():
    logger.info("Starting manual trade ingestion...")
    try:
        async with SessionLocal() as session:
            trade_ids = await ingest_trades(session)
            await session.commit()
            logger.info(f"Ingested {len(trade_ids)} new trades.")
            print(f"✅ Ingested {len(trade_ids)} new trades.")
    except Exception as e:
        logger.error(f"Ingestion failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run_ingest())
