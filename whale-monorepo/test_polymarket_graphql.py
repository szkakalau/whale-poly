#!/usr/bin/env python3
"""
使用Polymarket的GraphQL API获取市场信息
"""
import httpx
import asyncio
import json

async def test_polymarket_graphql():
    """测试Polymarket GraphQL API"""
    
    market_id = "0xe6c514f23ba2372184233b057e0ee350067407523eba250aaf3cf1b4f284a834"
    graphql_url = "https://api.thegraph.com/subgraphs/name/polymarket/matic-markets"
    
    print(f"测试市场ID: {market_id}")
    print(f"GraphQL端点: {graphql_url}")
    
    # GraphQL查询 - 根据conditionId获取市场信息
    query = {
        "query": """
        query GetMarket($conditionId: String!) {
          markets(where: {conditionId: $conditionId}) {
            id
            conditionId
            question
            slug
            status
          }
        }
        """,
        "variables": {
            "conditionId": market_id
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                graphql_url,
                json=query,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ GraphQL API响应成功")
                
                markets = data.get("data", {}).get("markets", [])
                print(f"找到 {len(markets)} 个匹配的市场")
                
                if markets:
                    print("\n=== 市场信息 ===")
                    for market in markets:
                        print(f"ID: {market.get('id')}")
                        print(f"Condition ID: {market.get('conditionId')}")
                        print(f"问题: {market.get('question')}")
                        print(f"Slug: {market.get('slug')}")
                        print(f"状态: {market.get('status')}")
                        print()
                    return True
                else:
                    print("❌ 未找到匹配的市场")
                    return False
                    
            else:
                print(f"❌ GraphQL API响应失败: HTTP {response.status_code}")
                print(f"响应内容: {response.text}")
                return False
                
    except Exception as e:
        print(f"❌ GraphQL API调用错误: {e}")
        return False

async def main():
    print("=== Polymarket GraphQL API测试 ===")
    
    success = await test_polymarket_graphql()
    
    if success:
        print("\n✅ GraphQL API测试成功！可以获取正确的市场标题")
    else:
        print("\n❌ GraphQL API测试失败！")
        print("可能的原因:")
        print("1. 市场ID不存在或已过期")
        print("2. GraphQL端点变更")
        print("3. 网络连接问题")

if __name__ == "__main__":
    asyncio.run(main())