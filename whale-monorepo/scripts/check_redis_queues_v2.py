
import asyncio
import os
from redis.asyncio import Redis
from dotenv import load_dotenv

load_dotenv()

async def check_queues():
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        print("REDIS_URL not found")
        return

    redis = Redis.from_url(redis_url, decode_responses=True)
    queues = ["trade_created", "whale_trade_created", "alert_created"]
    
    print("--- Redis 队列状态检查 ---")
    for q in queues:
        length = await redis.llen(q)
        print(f"队列: {q:20} 长度: {length}")
        if length > 0:
            # 偷看一眼第一条数据
            first_item = await redis.lindex(q, 0)
            print(f"  -> 首条数据样例: {first_item}")
    
    await redis.aclose()

if __name__ == "__main__":
    asyncio.run(check_queues())
