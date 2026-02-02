
import asyncio
from shared.db import engine
from sqlalchemy import text

async def check():
    try:
        async with engine.connect() as conn:
            res = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"))
            tables = [r[0] for r in res]
            print(f"Tables: {tables}")
            
            for table in ['users', 'tg_users', 'subscriptions', 'whale_follows', 'collections', 'smart_collections']:
                if table in tables:
                    res = await conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                    print(f"{table} count: {res.scalar()}")
                else:
                    print(f"{table} does not exist")
    except Exception as e:
        print(f"Database connection failed: {e}")
        print("Detailed error info:")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check())
