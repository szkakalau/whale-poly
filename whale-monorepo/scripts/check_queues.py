import asyncio
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.config import settings
from redis.asyncio import Redis

async def check_queues():
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    
    queues = [
        settings.trade_created_queue,
        settings.whale_trade_created_queue,
        settings.alert_created_queue
    ]
    
    print(f"--- 队列状态检查 ({datetime.now(timezone.utc)}) ---")
    
    for queue_name in queues:
        try:
            length = await redis.llen(queue_name)
            print(f"{queue_name}: {length} 条消息")
            
            # 查看最后几条消息
            if length > 0:
                messages = await redis.lrange(queue_name, -3, -1)
                print(f"  最近消息:")
                for i, msg in enumerate(messages):
                    try:
                        data = json.loads(msg)
                        print(f"    {i+1}: {data.get('trade_id', data.get('whale_trade_id', data.get('alert_id', '未知ID')))}")
                    except:
                        print(f"    {i+1}: {msg[:100]}...")
        except Exception as e:
            print(f"{queue_name}: 错误 - {e}")
    
    await redis.aclose()

if __name__ == "__main__":
    asyncio.run(check_queues())