
import asyncio
import sys
import os
from sqlalchemy import select, func, desc
from dotenv import load_dotenv

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from shared.db import SessionLocal
from shared.models import TradeRaw

load_dotenv()

async def find_top_wallets():
    async with SessionLocal() as session:
        print("Finding top wallets by volume...")
        stmt = (
            select(TradeRaw.wallet, func.sum(TradeRaw.amount * TradeRaw.price).label("volume"))
            .group_by(TradeRaw.wallet)
            .order_by(desc("volume"))
            .limit(20)
        )
        res = await session.execute(stmt)
        
        print(f"{'Wallet':<42} | {'Volume ($)':<15}")
        print("-" * 60)
        
        wallets = []
        for row in res:
            wallet, volume = row
            print(f"{wallet:<42} | ${volume:,.2f}")
            wallets.append(wallet)
            
        return wallets

if __name__ == "__main__":
    asyncio.run(find_top_wallets())
