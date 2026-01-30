#!/usr/bin/env python3
"""
直接测试Polymarket API连接和市场标题解析
"""
import httpx
import asyncio
import json

async def test_polymarket_api():
    """直接测试Polymarket API"""
    
    market_id = "0xe6c514f23ba2372184233b057e0ee350067407523eba250aaf3cf1b4f284a834"
    url = "https://clob.polymarket.com/events"
    
    print(f"测试市场ID: {market_id}")
    print(f"API端点: {url}")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # 尝试直接查询特定市场
            params = {"condition_id": market_id}
            response = await client.get(url, params=params)
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ API响应成功")
                print(f"响应数据长度: {len(data)}")
                
                if data:
                    print("\n=== 市场信息 ===")
                    for i, market in enumerate(data[:3]):  # 显示前3个结果
                        print(f"{i+1}. 标题: {market.get('title', 'N/A')}")
                        print(f"   Condition ID: {market.get('condition_id', 'N/A')}")
                        print(f"   Slug: {market.get('slug', 'N/A')}")
                        print(f"   Status: {market.get('status', 'N/A')}")
                        print()
                    
                    # 检查是否找到匹配的市场
                    matching_markets = [m for m in data if m.get('condition_id') == market_id]
                    if matching_markets:
                        print(f"✅ 找到匹配的市场: {matching_markets[0].get('title')}")
                        return True
                    else:
                        print("❌ 未找到匹配的市场ID")
                        return False
                else:
                    print("❌ API返回空数据")
                    return False
                    
            else:
                print(f"❌ API响应失败: HTTP {response.status_code}")
                print(f"响应内容: {response.text}")
                return False
                
    except Exception as e:
        print(f"❌ API调用错误: {e}")
        return False

async def main():
    print("=== Polymarket API直接测试 ===")
    
    success = await test_polymarket_api()
    
    if success:
        print("\n✅ API测试成功！可以获取正确的市场标题")
    else:
        print("\n❌ API测试失败！")
        print("可能的原因:")
        print("1. 网络连接问题")
        print("2. Polymarket API限制")
        print("3. 市场ID不存在或已过期")
        print("4. API端点变更")

if __name__ == "__main__":
    asyncio.run(main())