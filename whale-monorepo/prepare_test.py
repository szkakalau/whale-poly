import asyncio
import os
import sys
from sqlalchemy import select, update, delete

# Add project root to sys.path
sys.path.append(os.getcwd())

try:
    from shared.db import SessionLocal
    from shared.models import ActivationCode, Subscription
except ImportError as e:
    print(f"❌ Import Error: {e}")
    sys.exit(1)

async def prepare_test(code):
    print(f"\n🔧 PREPARING DATABASE FOR WEBHOOK TEST: {code}")
    print("="*50)
    
    async with SessionLocal() as session:
        # 1. Reset Activation Code
        ac = (await session.execute(select(ActivationCode).where(ActivationCode.code == code))).scalars().first()
        if not ac:
            print(f"❌ Activation code '{code}' not found!")
            return
        
        print(f"1️⃣  Activation Code '{code}' (Telegram: {ac.telegram_id})")
        if ac.used:
            await session.execute(
                update(ActivationCode)
                .where(ActivationCode.code == code)
                .values(used=False)
            )
            print("   ✅ Reset to used=False")
        else:
            print("   ℹ️  Already unused")

        # 2. Clear Old Subscriptions (Optional but recommended for clean test)
        # We delete ALL subscriptions for this user so we can see if the webhook creates a new one cleanly.
        subs = (await session.execute(select(Subscription).where(Subscription.telegram_id == ac.telegram_id))).scalars().all()
        if subs:
            count = len(subs)
            print(f"2️⃣  Found {count} existing subscription(s). Deleting to ensure clean test...")
            await session.execute(
                delete(Subscription)
                .where(Subscription.telegram_id == ac.telegram_id)
            )
            print(f"   ✅ Deleted {count} subscription(s).")
        else:
            print("2️⃣  No existing subscriptions found. Clean slate.")

        await session.commit()
        print("="*50)
        print("🎉 DATABASE READY! Now run 'python3 trigger_webhook.py' locally.")

if __name__ == "__main__":
    target_code = sys.argv[1] if len(sys.argv) > 1 else "E7Q8MEDY"
    asyncio.run(prepare_test(target_code))
