
import asyncio
import sys
import os
import logging

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from shared.db import SessionLocal
from services.whale_engine.engine import recompute_whale_stats
from shared.logging import configure_logging

# Configure logging to stdout
configure_logging("INFO")
logger = logging.getLogger(__name__)

async def run_recompute():
    logger.info("Starting manual whale_stats recomputation...")
    try:
        async with SessionLocal() as session:
            # recompute_whale_stats returns the number of wallets updated
            count = await recompute_whale_stats(session)
            await session.commit()
            logger.info(f"Recomputation complete. Updated {count} wallets.")
            print(f"✅ Successfully updated stats for {count} wallets.")
    except Exception as e:
        logger.error(f"Failed to recompute stats: {e}")
        # If connection error, print a friendly message
        if "Connect call failed" in str(e) or "Connection refused" in str(e):
            print("\n❌ Error: Could not connect to the database.")
            print("Please ensure PostgreSQL is running and accessible at localhost:5432.")
        else:
            print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(run_recompute())
