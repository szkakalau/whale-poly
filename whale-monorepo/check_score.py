import asyncio
from shared.db import SessionLocal
from shared.models import WhaleScore
from sqlalchemy import select

async def check():
    async with SessionLocal() as session:
        result = await session.execute(select(WhaleScore).where(WhaleScore.wallet_address == '0x000000000000000000000000000000000000dead'))
        score = result.scalar_one_or_none()
        print(f'Whale score for test wallet: {score.final_score if score else "Not found"}')

if __name__ == "__main__":
    asyncio.run(check())