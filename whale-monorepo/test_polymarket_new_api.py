#!/usr/bin/env python3
"""
使用Polymarket的新API端点获取市场信息
"""
import httpx
import asyncio
import json

async def test_polymarket_new_api():
    """测试Polymarket新API"""
    
    market_id = "0xe6c514f23ba2372184233b057e0ee350067407523eba250aaf3cf1b4f284a834"
    api_url = "https://gamma-api.polymarket.com/markets"
    
    print(f"测试市场ID: {market_id}")
    print(f"API端点: {api_url}")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # 尝试获取所有市场列表
            response = await client.get(api_url)
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ API响应成功")
                
                # 查找匹配的市场
                matching_markets = []
                for market in data:
                    # 检查各种可能的ID字段
                    market_ids = set()
                    for key in ['id', 'market_id', 'conditionId', 'condition_id', 'clobTokenId']:
                        if key in market:
                            market_ids.add(str(market[key]).lower())
                    
                    if market_id.lower() in market_ids:
                        matching_markets.append(market)
                
                print(f"找到 {len(matching_markets)} 个匹配的市场")
                
                if matching_markets:
                    print("\n=== 市场信息 ===")
                    for market in matching_markets:
                        print(f"标题: {market.get('title', market.get('question', 'N/A'))}")
                        print(f"ID: {market.get('id', 'N/A')}")
                        print(f"Condition ID: {market.get('conditionId', market.get('condition_id', 'N/A'))}")
                        print(f"Slug: {market.get('slug', 'N/A')}")
                        print(f"状态: {market.get('status', 'N/A')}")
                        print()
                    return True
                else:
                    print("❌ 未找到匹配的市场")
                    # 显示前几个市场以帮助调试
                    print("\n=== 前5个市场示例 ===")
                    for i, market in enumerate(data[:5]):
                        print(f"{i+1}. {market.get('title', market.get('question', 'N/A'))}")
                        print(f"   ID: {market.get('id', 'N/A')}")
                        print()
                    return False
                    
            else:
                print(f"❌ API响应失败: HTTP {response.status_code}")
                print(f"响应内容: {response.text[:200]}...")
                return False
                
    except Exception as e:
        print(f"❌ API调用错误: {e}")
        return False

async def main():
    print("=== Polymarket 新API测试 ===")
    
    success = await test_polymarket_new_api()
    
    if success:
        print("\n✅ API测试成功！可以获取正确的市场标题")
    else:
        print("\n❌ API测试失败！")
        print("可能的原因:")
        print("1. 市场ID不存在或已过期")
        print("2. API端点需要更新")
        print("3. 需要API密钥或认证")

if __name__ == "__main__":
    asyncio.run(main())