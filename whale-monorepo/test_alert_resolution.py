import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from shared.models import Base, WhaleTrade, TokenCondition
from services.trade_ingest.markets import resolve_market_title

# 使用 SQLite 内存数据库进行测试
TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

async def main():
    print("--- 开始验证警报解析流程 (使用 SQLite 内存数据库) ---")
    
    # 1. 初始化数据库引擎
    engine = create_async_engine(TEST_DB_URL)
    
    # 2. 创建表
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # 3. 创建会话工厂
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    
    # 测试用的 Token ID (用户提供的那个)
    test_token_id = "0x327564c78a036b06935b5e5314c1f0a586278537c2430f63c052c209a820f539"
    
    async with Session() as session:
        print(f"\n[测试 1] 首次解析 Token ID: {test_token_id}")
        print("(这将尝试调用 API，如果 API 失败则回退到占位符并缓存)")
        
        title = await resolve_market_title(session, test_token_id)
        print(f"解析结果: {title}")
        
        # 验证是否已存入数据库
        print("\n[测试 2] 验证数据库缓存...")
        cached = (await session.execute(
            select(TokenCondition).where(TokenCondition.token_id == test_token_id.lower())
        )).scalars().first()
        
        if cached:
            print(f"数据库中已找到缓存: {cached.question} (ConditionID: {cached.condition_id})")
        else:
            print("错误: 数据库中未找到缓存！")

        print("\n[测试 3] 再次解析 (应直接从缓存读取)...")
        title_second = await resolve_market_title(session, test_token_id)
        print(f"第二次解析结果: {title_second}")
        
    print("\n--- 验证结束 ---")

if __name__ == "__main__":
    try:
        import aiosqlite
    except ImportError:
        print("请先安装 aiosqlite: pip install aiosqlite")
    else:
        asyncio.run(main())
