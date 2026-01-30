#!/usr/bin/env python3
"""
调试市场标题解析功能
"""
import asyncio
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from shared.config import settings
from shared.db import SessionLocal

async def debug_resolve_market_title():
    """调试市场标题解析"""
    market_id = "0x327564c78a036b06935b5e5314c1f0a586278537c2430f63c052c209a820f539"
    
    print(f"=== 调试市场标题解析 ===")
    print(f"市场ID: {market_id}")
    print(f"Events API URL: {settings.polymarket_events_url}")
    
    # 测试直接调用API
    print(f"\n=== 直接API测试 ===")
    await test_direct_api_call(market_id)
    
    # 测试resolve_market_title函数
    print(f"\n=== resolve_market_title函数测试 ===")
    async with SessionLocal() as session:
        from services.trade_ingest.markets import resolve_market_title
        title = await resolve_market_title(session, market_id)
        print(f"解析结果: {title}")

async def test_direct_api_call(market_id):
    """直接测试Events API调用"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # 尝试获取events数据
            response = await client.get(settings.polymarket_events_url)
            
            print(f"API状态码: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"获取到 {len(data)} 个events")
                
                # 查找匹配的市场
                for event in data:
                    if 'markets' in event:
                        for market in event['markets']:
                            market_ids = set()
                            for key in ['id', 'market_id', 'conditionId', 'condition_id', 'clobTokenId']:
                                if key in market:
                                    market_ids.add(str(market[key]).lower())
                            
                            if market_id.lower() in market_ids:
                                print(f"✅ 找到匹配的市场!")
                                print(f"标题: {market.get('title', market.get('question', 'N/A'))}")
                                print(f"完整数据: {market}")
                                return True
                
                print("❌ 在events中未找到匹配的市场")
                # 显示前几个events的结构
                if data:
                    print(f"\n=== 第一个event示例 ===")
                    first_event = data[0]
                    print(f"Event ID: {first_event.get('id')}")
                    print(f"Event 标题: {first_event.get('title')}")
                    if 'markets' in first_event and first_event['markets']:
                        first_market = first_event['markets'][0]
                        print(f"第一个市场ID: {first_market.get('id')}")
                        print(f"第一个市场标题: {first_market.get('title')}")
                
            else:
                print(f"❌ API响应失败: {response.status_code}")
                print(f"响应内容: {response.text[:200]}...")
                
    except Exception as e:
        print(f"❌ API调用错误: {e}")

async def main():
    await debug_resolve_market_title()

if __name__ == "__main__":
    asyncio.run(main())