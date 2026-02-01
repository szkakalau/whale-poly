import asyncio
import json
import os
import sys
from datetime import datetime, timezone

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.config import settings
from shared.db import SessionLocal
from shared.models import TradeRaw
from sqlalchemy import insert
from redis.asyncio import Redis

async def push_test_message():
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    
    # Create test trade data
    fake_trade_id = f"MANUAL_TEST_{int(datetime.now().timestamp())}"
    now = datetime.now(timezone.utc)
    trade_data = {
        "trade_id": fake_trade_id,
        "market_id": "0x0f05ef0920174a9b2d079bb040e1e6e0b48a684b702ba0e668d100eb4b3ac021",
        "market_title": "MANUAL WHALE ALERT",
        "wallet": "0x000000000000000000000000000000000000dead",
        "side": "buy",
        "amount": 10000,
        "price": 1.0,
        "timestamp": now
    }
    
    # Create separate copy for Redis (with ISO timestamp)
    trade_data_for_redis = trade_data.copy()
    trade_data_for_redis["timestamp"] = now.isoformat()
    
    print(f"--- 手动测试开始 ---")
    print(f"测试交易ID: {fake_trade_id}")
    
    # 1. Insert into database
    async with SessionLocal() as session:
        await session.execute(insert(TradeRaw).values(**trade_data))
        await session.commit()
    print(f"1. 已插入测试交易到数据库: {fake_trade_id}")
    
    # 2. Push to Redis queue
    print(f"2. 推送测试交易到 Redis 队列: {settings.trade_created_queue}")
    
    # Test Redis connection
    ping_result = await redis.ping()
    print(f"DEBUG: Redis PING result: {ping_result}")
    
    # Push message
    push_result = await redis.rpush(settings.trade_created_queue, json.dumps(trade_data_for_redis))
    print(f"DEBUG: RPUSH result: {push_result}")
    
    # Check queue length
    queue_len_after_push = await redis.llen(settings.trade_created_queue)
    print(f"DEBUG: '{settings.trade_created_queue}' 队列长度: {queue_len_after_push}")
    
    await redis.aclose()
    
    print(f"3. 测试消息已推送，请检查 whale-engine-worker 日志")
    print(f"   - 应该显示 'consumed_trades count=1 created_whales=1'")
    print(f"   - 如果成功，检查 alert-engine-worker 和 telegram-bot 日志")

if __name__ == "__main__":
    asyncio.run(push_test_message())