import asyncio
import os
import sys

# Add project root to sys.path
sys.path.append(os.getcwd())

try:
    from shared.db import SessionLocal
    from shared.models import ActivationCode, Subscription
    from sqlalchemy import select
except ImportError as e:
    print(f"❌ Import Error: {e}")
    print(f"Current Working Directory: {os.getcwd()}")
    print(f"Sys Path: {sys.path}")
    sys.exit(1)

async def verify(code):
    print(f"\n🔍 Verifying activation code: {code}")
    print("="*40)
    
    async with SessionLocal() as session:
        # 1. Check Activation Code
        ac = (await session.execute(select(ActivationCode).where(ActivationCode.code == code))).scalars().first()
        if not ac:
            print(f"❌ Activation code '{code}' not found in database!")
            return
        
        print(f"✅ Activation Code found.")
        print(f"   - Code: {ac.code}")
        print(f"   - Telegram ID: {ac.telegram_id}")
        print(f"   - Used: {ac.used} (Expected: True)")
        
        if not ac.used:
            print("❌ FAILURE: Activation code is NOT marked as used.")
            return
        else:
            print("✅ Activation code status is correct.")

        print("-" * 20)

        # 2. Check Subscription
        sub = (await session.execute(select(Subscription).where(Subscription.telegram_id == ac.telegram_id))).scalars().first()
        if not sub:
            print(f"❌ FAILURE: No subscription found for Telegram ID {ac.telegram_id}")
            return
        
        print(f"✅ Subscription found.")
        print(f"   - ID: {sub.id}")
        print(f"   - Status: {sub.status} (Expected: active)")
        print(f"   - Plan: {sub.plan} (Expected: pro)")
        print(f"   - Current Period End: {sub.current_period_end}")

        print("="*40)
        if sub.status == 'active' and sub.plan == 'pro':
            print("🎉 VERIFICATION SUCCESS: Payment flow is complete and correct!")
        else:
            print("❌ FAILURE: Subscription status or plan is incorrect.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python verify_payment.py <ACTIVATION_CODE>")
    else:
        asyncio.run(verify(sys.argv[1]))
