
import asyncio
import os
from redis.asyncio import Redis
from dotenv import load_dotenv

load_dotenv()

async def fix_redis():
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        print("REDIS_URL not found")
        return

    redis = Redis.from_url(redis_url, decode_responses=True)
    try:
        print("正在尝试修复 Redis 写入限制...")
        # 强制关闭 'stop-writes-on-bgsave-error'
        await redis.config_set("stop-writes-on-bgsave-error", "no")
        print("SUCCESS: 已关闭 stop-writes-on-bgsave-error，Redis 应该可以重新写入了。")
    except Exception as e:
        print(f"FAILED: 无法修复 Redis: {e}")
        print("这通常意味着您使用的是受限的云服务，无法执行 CONFIG 命令。")
    finally:
        await redis.aclose()

if __name__ == "__main__":
    asyncio.run(fix_redis())
