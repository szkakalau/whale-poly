import asyncio
from shared.db import SessionLocal
from shared.models import Alert
from sqlalchemy import select

async def check():
    async with SessionLocal() as session:
        # Check for alerts from our test trades
        result = await session.execute(select(Alert))
        alerts = result.scalars().all()
        print(f'Found {len(alerts)} total alerts:')
        for alert in alerts:
            print(f'  - ID: {alert.id}, Whale Trade ID: {alert.whale_trade_id}, Score: {alert.whale_score}, Type: {alert.alert_type}')

if __name__ == "__main__":
    asyncio.run(check())