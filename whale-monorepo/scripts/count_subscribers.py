import asyncio
import os
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Add the project root to sys.path to import shared
import sys
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(project_root)

from shared.models.models import Subscription, Base, TgUser, ActivationCode, TradeRaw
from shared.config import settings

async def count_subscribers():
    # Use the normalized database URL from settings
    db_url = settings.database_url
    
    engine = create_async_engine(db_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Count active/trialing subscriptions
        sub_query = select(func.count()).select_from(Subscription)
        active_sub_query = select(func.count()).select_from(Subscription).where(Subscription.status.in_(["active", "trialing"]))
        
        # Count total Telegram users
        tg_query = select(func.count()).select_from(TgUser)
        
        # Count used activation codes (test users)
        ac_query = select(func.count()).select_from(ActivationCode).where(ActivationCode.used == True)
        
        # Count total raw trades
        tr_query = select(func.count()).select_from(TradeRaw)
        
        res_total = await session.execute(sub_query)
        res_active = await session.execute(active_sub_query)
        res_tg = await session.execute(tg_query)
        res_ac = await session.execute(ac_query)
        res_tr = await session.execute(tr_query)
        
        total_subs = res_total.scalar()
        active_subs = res_active.scalar()
        total_tg_users = res_tg.scalar()
        used_codes = res_ac.scalar()
        total_trades = res_tr.scalar()
        
        print(f"--- 订阅与系统状态统计 ---")
        print(f"Stripe 总订阅记录: {total_subs}")
        print(f"Stripe 激活中订阅: {active_subs}")
        print(f"已使用的激活码 (测试/内部用户): {used_codes}")
        print(f"系统总注册用户数 (TgUser): {total_tg_users}")
        print(f"原始交易总数 (TradeRaw): {total_trades}")
        print(f"--------------------------")

if __name__ == "__main__":
    if not os.getenv("DATABASE_URL"):
        print("错误: 请先设置 DATABASE_URL 环境变量")
        sys.exit(1)
    asyncio.run(count_subscribers())
