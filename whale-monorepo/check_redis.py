
import asyncio
from redis.asyncio import Redis
from shared.config import settings

async def check():
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    try:
        q_len = await redis.llen(settings.alert_created_queue)
        print(f"Queue {settings.alert_created_queue} length: {q_len}")
        
        # Check other queues
        for q in [settings.trade_created_queue, settings.whale_trade_created_queue]:
            l = await redis.llen(q)
            print(f"Queue {q} length: {l}")
            
    finally:
        await redis.aclose()

if __name__ == "__main__":
    asyncio.run(check())
