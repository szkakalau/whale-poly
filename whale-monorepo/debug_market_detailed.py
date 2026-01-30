#!/usr/bin/env python3
"""
详细调试市场ID，检查所有可能的API端点
"""
import asyncio
import httpx

async def debug_market_id_detailed():
    """详细调试市场ID"""
    market_id = "0x327564c78a036b06935b5e5314c1f0a586278537c2430f63c052c209a820f539"
    
    print(f"=== 详细调试市场ID ===")
    print(f"市场ID: {market_id}")
    print(f"ID长度: {len(market_id)} 字符")
    print(f"是否为有效的哈希: {market_id.startswith('0x') and len(market_id) == 66}")
    
    # 测试所有可能的API端点
    endpoints = [
        "https://gamma-api.polymarket.com/events",
        "https://gamma-api.polymarket.com/markets",
        "https://clob.polymarket.com/markets",
        "https://data-api.polymarket.com/markets",
    ]
    
    for endpoint in endpoints:
        print(f"\n=== 测试端点: {endpoint} ===")
        await test_endpoint(endpoint, market_id)

async def test_endpoint(endpoint, market_id):
    """测试单个API端点"""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(endpoint)
            
            print(f"状态码: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list):
                    print(f"获取到 {len(data)} 条记录")
                    
                    # 查找匹配的市场
                    found = False
                    for item in data:
                        if _find_market_in_item(item, market_id):
                            found = True
                            break
                    
                    if not found:
                        print("❌ 未找到匹配的市场")
                        # 显示一些示例数据
                        if data:
                            print(f"前3条记录的ID示例:")
                            for i, item in enumerate(data[:3]):
                                item_ids = _extract_all_ids(item)
                                print(f"  {i+1}. {item_ids}")
                else:
                    print(f"响应数据类型: {type(data)}")
                    print(f"数据结构: {list(data.keys()) if isinstance(data, dict) else '非字典结构'}")
                    
            else:
                print(f"❌ 请求失败: {response.status_code}")
                print(f"响应: {response.text[:100]}...")
                
    except Exception as e:
        print(f"❌ 请求错误: {e}")

def _find_market_in_item(item, target_id):
    """在数据项中查找市场"""
    target_id = target_id.lower()
    
    # 检查item本身是否是市场
    if _item_has_market_id(item, target_id):
        print(f"✅ 找到匹配的市场!")
        print(f"标题: {item.get('title', item.get('question', 'N/A'))}")
        print(f"完整数据: {item}")
        return True
    
    # 检查item中的markets字段
    if 'markets' in item and isinstance(item['markets'], list):
        for market in item['markets']:
            if _item_has_market_id(market, target_id):
                print(f"✅ 在markets字段中找到匹配的市场!")
                print(f"标题: {market.get('title', market.get('question', 'N/A'))}")
                print(f"所属Event: {item.get('title')}")
                return True
    
    return False

def _item_has_market_id(item, target_id):
    """检查数据项是否有匹配的ID"""
    id_fields = ['id', 'market_id', 'conditionId', 'condition_id', 'clobTokenId', 'token_id']
    
    for field in id_fields:
        if field in item:
            field_value = str(item[field]).lower()
            if field_value == target_id:
                return True
    return False

def _extract_all_ids(item):
    """提取数据项中的所有ID字段"""
    ids = {}
    id_fields = ['id', 'market_id', 'conditionId', 'condition_id', 'clobTokenId', 'token_id']
    
    for field in id_fields:
        if field in item:
            ids[field] = item[field]
    
    return ids if ids else "无ID字段"

async def main():
    await debug_market_id_detailed()

if __name__ == "__main__":
    asyncio.run(main())