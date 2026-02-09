import asyncio
import os
import sys
from sqlalchemy import select, update

# Add project root to sys.path
sys.path.append(os.getcwd())

try:
    from shared.db import SessionLocal
    from shared.models import ActivationCode
except ImportError as e:
    print(f"❌ Import Error: {e}")
    sys.exit(1)

async def reset_code(code):
    print(f"\n🔄 Resetting activation code: {code}")
    
    async with SessionLocal() as session:
        # Check current status
        ac = (await session.execute(select(ActivationCode).where(ActivationCode.code == code))).scalars().first()
        if not ac:
            print(f"❌ Activation code '{code}' not found!")
            return
        
        print(f"Current status: used={ac.used}")
        
        if not ac.used:
            print("⚠️ Code is already unused. No changes needed.")
            return

        # Reset to unused
        await session.execute(
            update(ActivationCode)
            .where(ActivationCode.code == code)
            .values(used=False)
        )
        await session.commit()
        print("✅ Successfully reset code to used=False")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python reset_activation.py <ACTIVATION_CODE>")
    else:
        asyncio.run(reset_code(sys.argv[1]))
