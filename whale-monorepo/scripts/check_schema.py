
import asyncio
from sqlalchemy import text
from shared.db import engine

async def check_schema():
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'trades_raw'"))
        columns = [row[0] for row in result.fetchall()]
        print(f"Columns in trades_raw: {columns}")
        if 'market_title' in columns:
            print("SUCCESS: market_title column exists.")
        else:
            print("FAILURE: market_title column MISSING.")

if __name__ == "__main__":
    asyncio.run(check_schema())
