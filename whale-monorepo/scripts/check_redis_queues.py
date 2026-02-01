
import asyncio
import os
from redis.asyncio import Redis
from dotenv import load_dotenv

load_dotenv()

async def check_queues():
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        print("REDIS_URL not found in .env")
        return

    redis = Redis.from_url(redis_url, decode_responses=True)
    try:
        queues = ["trade_created", "whale_trade_created", "alert_created"]
        for q in queues:
            length = await redis.llen(q)
            print(f"Queue: {q}, Length: {length}")
    except Exception as e:
        print(f"Error checking Redis: {e}")
    finally:
        await redis.aclose()

if __name__ == "__main__":
    asyncio.run(check_queues())
