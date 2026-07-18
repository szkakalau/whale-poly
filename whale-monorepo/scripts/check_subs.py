import asyncio
import sys
sys.path.insert(0, '.')
from shared.db import SessionLocal
from shared.models import Subscription, Delivery, Alert
from sqlalchemy import select, func
from datetime import datetime, timezone

async def main():
    async with SessionLocal() as s:
        now = datetime.now(timezone.utc)

        print("=== Subscriptions ===")
        rows = (await s.execute(select(Subscription))).scalars().all()
        for r in rows:
            expired = "YES" if r.current_period_end and r.current_period_end < now else "no"
            print(f"  telegram_id={r.telegram_id} status={r.status} plan={r.plan} period_end={r.current_period_end} expired={expired}")

        print("\n=== Recent Deliveries (last 20) ===")
        deliveries = (await s.execute(
            select(Delivery).order_by(Delivery.created_at.desc()).limit(20)
        )).scalars().all()
        for d in deliveries:
            print(f"  telegram_id={d.telegram_id} whale_trade_id={d.whale_trade_id} delivered_at={d.delivered_at}")

        delivery_total = (await s.execute(
            select(func.count()).select_from(Delivery)
        )).scalar()
        alert_total = (await s.execute(
            select(func.count()).select_from(Alert)
        )).scalar()
        print(f"\nTotal Alerts: {alert_total}, Total Deliveries: {delivery_total}")

asyncio.run(main())
