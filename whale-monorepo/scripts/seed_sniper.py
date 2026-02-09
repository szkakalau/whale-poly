
import asyncio
import sys
import os
import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from shared.db import SessionLocal, insert
from shared.models import TradeRaw, Market, WalletName

# A deterministic wallet address for our "Sniper"
SNIPER_WALLET = "0xSniperWhale009" + "1" * 26 # 42 chars

async def seed_sniper():
    print(f"🌱 Seeding Sniper data for {SNIPER_WALLET}...")
    
    async with SessionLocal() as session:
        now = datetime.now(timezone.utc)
        
        # 1. Create a Market if needed
        market_id = "market_sniper_003"
        await session.execute(
            insert(Market).values(
                id=market_id,
                title="Will the Sniper feature work correctly? (v3)",
                # slug="sniper-feature-test",
                created_at=now
            ).on_conflict_do_nothing()
        )
        
        trades_to_insert = []
        
        # 0. Seed Capital Trade (to boost Whale Score > 90)
        # Needs > $50k volume in last 30d
        # Use a DIFFERENT market so it doesn't mess up the PnL of the sniper market
        seed_market_id = "market_seed_001"
        trades_to_insert.append({
            "trade_id": f"sniper_seed_{random.randint(100000,999999)}",
            "market_id": seed_market_id,
            "market_title": "Seed Capital Market",
            "wallet": SNIPER_WALLET,
            "side": "buy",
            "amount": 100000, # $100k
            "price": 1.0,
            "timestamp": now - timedelta(days=7)
        })
        
                # Helper to create trade pairs
        # Amount needs to be large enough to qualify as Whale Trade (> $3000 for spike, or accumulated)
        # Price 0.5 * 10000 = $5000
        def add_pair(day_offset, buy_price, sell_price, amount=10000):
            base_time = now - timedelta(days=day_offset)
            # Buy
            trades_to_insert.append({
                "trade_id": f"sniper_buy_{day_offset}_{random.randint(10000,99999)}",
                "market_id": market_id,
                "market_title": "Will the Sniper feature work correctly? (v3)",
                "wallet": SNIPER_WALLET,
                "side": "buy",
                "amount": amount,
                "price": buy_price,
                "timestamp": base_time
            })
            # Sell 1 hour later
            trades_to_insert.append({
                "trade_id": f"sniper_sell_{day_offset}_{random.randint(10000,99999)}",
                "market_id": market_id,
                "market_title": "Will the Sniper feature work correctly? (v3)",
                "wallet": SNIPER_WALLET,
                "side": "sell",
                "amount": amount,
                "price": sell_price,
                "timestamp": base_time + timedelta(hours=1)
            })

        # 10 Wins (All Profit)
        for i in range(10):
            day_off = (i % 7) + 2 # 2 to 8 days ago
            add_pair(day_off, 0.50, 0.80) # +3000 profit each

        # Spotlight Trade (Buy in last 24h)
        trades_to_insert.append({
            "trade_id": f"sniper_spotlight_{random.randint(10000,99999)}",
            "market_id": market_id,
            "market_title": "Will the Sniper feature work correctly? (v3)",
            "wallet": SNIPER_WALLET,
            "side": "buy",
            "amount": 5000,
            "price": 0.65,
            "timestamp": now - timedelta(minutes=30)
        })

        # Add Wallet Name
        await session.execute(
            insert(WalletName).values(
                wallet_address=SNIPER_WALLET,
                polymarket_username="SniperBot_009",
                source="manual_seed"
            ).on_conflict_do_nothing()
        )

        # Bulk Insert
        for t in trades_to_insert:
            await session.execute(
                insert(TradeRaw).values(**t).on_conflict_do_nothing()
            )
            
        await session.commit()
        print(f"✅ Inserted {len(trades_to_insert)} trades for Sniper.")

if __name__ == "__main__":
    asyncio.run(seed_sniper())
