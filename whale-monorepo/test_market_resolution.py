#!/usr/bin/env python3
"""
测试市场标题解析功能
"""
import asyncio
import sys
sys.path.append('.')

from services.trade_ingest.markets import resolve_market_title
from shared.db import SessionLocal

async def test_market_resolution():
    """测试特定市场ID的标题解析"""
    
    # 您提供的市场ID
    market_id = "0xe6c514f23ba2372184233b057e0ee350067407523eba250aaf3cf1b4f284a834"
    
    print(f"测试市场ID: {market_id}")
    
    try:
        async with SessionLocal() as session:
            title = await resolve_market_title(session, market_id)
            
            if title:
                print(f"✅ 成功解析市场标题: {title}")
                return True
            else:
                print("❌ 无法解析市场标题")
                return False
                
    except Exception as e:
        print(f"❌ 解析过程中出现错误: {e}")
        return False

async def main():
    print("=== 市场标题解析测试 ===")
    
    success = await test_market_resolution()
    
    if success:
        print("\n✅ 测试成功！市场标题解析功能正常工作")
    else:
        print("\n❌ 测试失败！请检查以下可能的问题:")
        print("1. Polymarket API连接问题")
        print("2. 网络连接问题") 
        print("3. 市场ID是否正确")
        print("4. API端点是否可用")

if __name__ == "__main__":
    asyncio.run(main())