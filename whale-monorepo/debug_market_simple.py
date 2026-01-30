#!/usr/bin/env python3
"""
简单调试市场标题解析功能（无需数据库）
"""
import asyncio
import httpx
from shared.config import settings

async def debug_market_resolution():
    """调试市场标题解析"""
    market_id = "0x327564c78a036b06935b5e5314c1f0a586278537c2430f63c052c209a820f539"
    
    print(f"=== 调试市场标题解析 ===")
    print(f"市场ID: {market_id}")
    print(f"Events API URL: {settings.polymarket_events_url}")
    
    # 测试直接调用Events API
    print(f"\n=== 直接Events API测试 ===")
    await test_events_api(market_id)
    
    # 测试Markets API作为备选
    print(f"\n=== Markets API测试 ===")
    await test_markets_api(market_id)

async def test_events_api(market_id):
    """测试Events API"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(settings.polymarket_events_url)
            
            print(f"Events API状态码: {response.status_code}")
            
            if response.status_code == 200:
                events = response.json()
                print(f"获取到 {len(events)} 个events")
                
                # 查找匹配的市场
                found = False
                for event in events:
                    if 'markets' in event:
                        for market in event['markets']:
                            if _market_matches(market, market_id):
                                print(f"✅ 在Events中找到匹配的市场!")
                                print(f"标题: {market.get('title', market.get('question', 'N/A'))}")
                                print(f"Event标题: {event.get('title')}")
                                found = True
                                break
                        if found:
                            break
                
                if not found:
                    print("❌ 在Events中未找到匹配的市场")
                    if events:
                        print(f"第一个event结构: {list(events[0].keys())}")
                        if 'markets' in events[0] and events[0]['markets']:
                            first_market = events[0]['markets'][0]
                            print(f"第一个市场结构: {list(first_market.keys())}")
                            
            else:
                print(f"❌ Events API响应失败: {response.status_code}")
                print(f"响应内容: {response.text[:200]}...")
                
    except Exception as e:
        print(f"❌ Events API调用错误: {e}")

async def test_markets_api(market_id):
    """测试Markets API"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            markets_url = "https://gamma-api.polymarket.com/markets"
            response = await client.get(markets_url)
            
            print(f"Markets API状态码: {response.status_code}")
            
            if response.status_code == 200:
                markets = response.json()
                print(f"获取到 {len(markets)} 个markets")
                
                # 查找匹配的市场
                found = False
                for market in markets:
                    if _market_matches(market, market_id):
                        print(f"✅ 在Markets中找到匹配的市场!")
                        print(f"标题: {market.get('title', market.get('question', 'N/A'))}")
                        print(f"ID: {market.get('id')}")
                        found = True
                        break
                
                if not found:
                    print("❌ 在Markets中未找到匹配的市场")
                    if markets:
                        print(f"前3个市场标题:")
                        for i, market in enumerate(markets[:3]):
                            print(f"  {i+1}. {market.get('title', market.get('question', 'N/A'))}")
                            print(f"     ID: {market.get('id')}")
                            
            else:
                print(f"❌ Markets API响应失败: {response.status_code}")
                print(f"响应内容: {response.text[:200]}...")
                
    except Exception as e:
        print(f"❌ Markets API调用错误: {e}")

def _market_matches(market, target_id):
    """检查市场是否匹配目标ID"""
    target_id = target_id.lower()
    id_fields = ['id', 'market_id', 'conditionId', 'condition_id', 'clobTokenId', 'token_id']
    
    for field in id_fields:
        if field in market:
            field_value = str(market[field]).lower()
            if field_value == target_id:
                return True
    return False

async def main():
    await debug_market_resolution()

if __name__ == "__main__":
    asyncio.run(main())