
import asyncio
import json
import os
from datetime import datetime, timezone

import httpx
from dotenv import load_dotenv
from sqlalchemy import insert
from redis.asyncio import Redis

from shared.config import settings
from shared.db import SessionLocal
from shared.models import TradeRaw


load_dotenv()

async def test_flow():
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    # 模拟一笔超大额交易
    fake_trade_id = f"FINAL_TEST_{int(datetime.now().timestamp())}"
    now = datetime.now(timezone.utc)
    trade_data = {
        "trade_id": fake_trade_id,
        "market_id": "0x0f05ef0920174a9b2d079bb040e1e6e0b48a684b702ba0e668d100eb4b3ac021",
        "market_title": "TEST WHALE ALERT",
        "wallet": "0x000000000000000000000000000000000000dead",
        "side": "buy",
        "amount": 10000,
        "price": 1.0,
        "timestamp": now
    }
    
    trade_data_for_redis = trade_data.copy()
    trade_data_for_redis["timestamp"] = now.isoformat()
    
    print(f"--- 模拟测试开始 ---")
    
    # 0. 插入数据库
    async with SessionLocal() as session:
        await session.execute(insert(TradeRaw).values(**trade_data))
        await session.commit()
    print(f"0. 已插入模拟交易到数据库: {fake_trade_id}")

    # 1. 推送模拟交易 ID 到 Celery 队列
    print(f"1. 推送模拟交易 ID 到 Redis 队列: {fake_trade_id}")
    print(f"DEBUG: Pushing to Redis queue: {settings.trade_created_queue}")
    ping_result = await redis.ping()
    print(f"DEBUG: Redis PING result: {ping_result}")
    push_result = await redis.rpush(settings.trade_created_queue, json.dumps(trade_data_for_redis))
    print(f"DEBUG: RPUSH result: {push_result}")
    queue_len_after_push = await redis.llen(settings.trade_created_queue)
    print(f"DEBUG: Length of '{settings.trade_created_queue}' queue after push: {queue_len_after_push}")
    await asyncio.sleep(2) # Add a 2-second delay to allow worker to pick up the message
    
    print(f"2. 模拟数据已进入 Redis 队列")
    print(f"请检查以下服务的日志：")
    print(f"   - whale-engine-worker: 应该显示 'consumed_trades count=1 created_whales=1'")
    print(f"   - alert-engine-worker: 应该处理该鲸鱼交易并生成告警")
    print(f"   - telegram-bot: 应该尝试发送消息")

    base = os.getenv("HEALTH_WHALE_ENGINE_API_URL", settings.health_whale_engine_api_url)
    url = base.rstrip("/") + f"/whales/{trade_data['wallet'].lower()}"
    print(f"3. 调用鲸鱼画像接口: {url}")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=30)
        print(f"Whale profile status: {resp.status_code}")
        print(f"Whale profile body: {resp.text}")
    except Exception as e:
        print(f"Whale profile request failed: {e}")

    await redis.aclose()

if __name__ == "__main__":
    asyncio.run(test_flow())
