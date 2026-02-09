import asyncio
from sqlalchemy import select, func
from shared.db import get_session as get_db_session
from shared.models import WhaleStats, WhaleProfile, WhaleTradeHistory

async def main():
    async for session in get_db_session():
        # Check WhaleTradeHistory for Sniper
        stmt = select(func.count(WhaleTradeHistory.trade_id)).where(WhaleTradeHistory.wallet_address.like("0xSniperWhale009%"))
        res = await session.execute(stmt)
        history_count = res.scalar()
        print(f"Sniper History Rows: {history_count}")
        
        # Check WhaleStats count
        result = await session.execute(select(func.count(WhaleStats.wallet_address)))
        count = result.scalar()
        print(f"Total WhaleStats rows: {count}")
        
        # Check max win_rate
        result = await session.execute(select(func.max(WhaleStats.win_rate)))
        max_wr = result.scalar()
        print(f"Max Win Rate: {max_wr}")

        # Check WhaleProfile count
        result = await session.execute(select(func.count(WhaleProfile.wallet_address)))
        p_count = result.scalar()
        print(f"Total WhaleProfile rows: {p_count}")

        # Check max trades
        result = await session.execute(select(func.max(WhaleProfile.total_trades)))
        max_trades = result.scalar()
        print(f"Max Trades: {max_trades}")

        if count > 0:
            stmt = select(WhaleStats).limit(1)
            res = await session.execute(stmt)
            stat = res.scalar_one()
            print(f"Sample Stat: Wallet={stat.wallet_address}, WinRate={stat.win_rate}")

            # Check Sniper Wallet
            stmt = select(WhaleStats).where(WhaleStats.wallet_address.like("0xSniperWhale009%"))
            res = await session.execute(stmt)
            sniper = res.scalar_one_or_none()
            if sniper:
                print(f"Sniper Stats: WinRate={sniper.win_rate}")
                
            stmt = select(WhaleProfile).where(WhaleProfile.wallet_address.like("0xSniperWhale009%"))
            res = await session.execute(stmt)
            profile = res.scalar_one_or_none()
            if profile:
                print(f"Sniper Profile: TotalTrades={profile.total_trades}, Wins={profile.wins}, Losses={profile.losses}")


if __name__ == "__main__":
    asyncio.run(main())
