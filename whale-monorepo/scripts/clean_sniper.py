import asyncio
from sqlalchemy import text
from shared.db import get_session

async def main():
    async for session in get_session():
        print("Cleaning Sniper data...")
        await session.execute(text("DELETE FROM trades_raw WHERE wallet LIKE '0xSniperWhale%'"))
        await session.execute(text("DELETE FROM whale_trade_history WHERE wallet_address LIKE '0xSniperWhale%'"))
        await session.execute(text("DELETE FROM whale_positions WHERE wallet_address LIKE '0xSniperWhale%'"))
        await session.execute(text("DELETE FROM whale_stats WHERE wallet_address LIKE '0xSniperWhale%'"))
        await session.execute(text("DELETE FROM whale_profiles WHERE wallet_address LIKE '0xSniperWhale%'"))
        await session.execute(text("DELETE FROM whale_scores WHERE wallet_address LIKE '0xSniperWhale%'"))
        await session.commit()
        print("Cleaned.")

if __name__ == "__main__":
    asyncio.run(main())
