import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

import argparse
from collections import namedtuple

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

try:
    from shared.models.models import TradeRaw, WhaleStats, Market, WalletName, WhaleProfile
except ImportError:
    print("Error: Could not import shared models. Make sure you are running this from the project root or 'scripts' directory.")
    sys.exit(1)

# Argument Parser
parser = argparse.ArgumentParser(description='Generate Daily Alpha Spotlight content.')
parser.add_argument('--mock', action='store_true', help='Use mock data for demonstration purposes')
args = parser.parse_args()

load_dotenv()

async def get_daily_spotlight():
    if args.mock:
        print("⚠️  Running in MOCK mode (Demonstration Data)\n")
        # Mock Data Generation
        MockTrade = namedtuple('MockTrade', ['amount', 'price', 'wallet', 'timestamp'])
        MockMarket = namedtuple('MockMarket', ['title'])
        MockWalletName = namedtuple('MockWalletName', ['polymarket_username'])
        
        # 1. Big Spender Mock
        big_spender = (
            MockTrade(amount=250000, price=0.45, wallet="0x1234...abcd", timestamp=datetime.now()), 
            "Will Trump win the 2024 Election?", 
            "TrumpWhale99"
        )
        
        # 2. Contrarian Mock
        contrarian = (
            MockTrade(amount=50000, price=0.15, wallet="0xabcd...1234", timestamp=datetime.now()),
            "Will Bitcoin hit $100k by March?",
            None
        )
        
        # 3. Sniper Mock
        sniper = (
            MockTrade(amount=10000, price=0.60, wallet="0x9999...8888", timestamp=datetime.now()),
            "Super Bowl Winner: Chiefs",
            0.88,
            "SmartMoney_007"
        )
        
    else:
        # Real DB Logic
        DATABASE_URL = os.getenv("DATABASE_URL")
        if not DATABASE_URL:
             # Try to find .env in parent directory
            parent_env = os.path.join(os.path.dirname(__file__), '..', '.env')
            if os.path.exists(parent_env):
                load_dotenv(parent_env)
                DATABASE_URL = os.getenv("DATABASE_URL")

        if not DATABASE_URL:
            print("Error: DATABASE_URL not found. Use --mock to test without DB.")
            sys.exit(1)

        # Fix for asyncpg
        if "postgresql+asyncpg://" not in DATABASE_URL:
            if DATABASE_URL.startswith("postgres://"):
                DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
            elif DATABASE_URL.startswith("postgresql://"):
                DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
            elif DATABASE_URL.startswith("sqlite:///"):
                DATABASE_URL = DATABASE_URL.replace("sqlite:///", "sqlite+aiosqlite:///", 1)

        try:
            engine = create_async_engine(DATABASE_URL, echo=False)
            AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
            
            async with AsyncSessionLocal() as session:
                now = datetime.now(timezone.utc)
                start_time = now - timedelta(hours=24)
                
                print(f"🔍 Generating Daily Spotlight for {now.date()} (Last 24h)...")
                print(f"   (Scanning from {start_time.strftime('%Y-%m-%d %H:%M:%S')} UTC)\n")
                
                # --- DIAGNOSTICS REMOVED ---
                
                # 1. Big Spender
                stmt_spender = (
                    select(TradeRaw, Market.title, WalletName.polymarket_username)
                    .outerjoin(Market, TradeRaw.market_id == Market.id)
                    .outerjoin(WalletName, TradeRaw.wallet == WalletName.wallet_address)
                    .where(TradeRaw.timestamp >= start_time)
                    .where(TradeRaw.side == 'buy')
                    .order_by(desc(TradeRaw.amount * TradeRaw.price))
                    .limit(1)
                )
                
                # 2. Contrarian
                stmt_contrarian = (
                    select(TradeRaw, Market.title, WalletName.polymarket_username)
                    .outerjoin(Market, TradeRaw.market_id == Market.id)
                    .outerjoin(WalletName, TradeRaw.wallet == WalletName.wallet_address)
                    .where(TradeRaw.timestamp >= start_time)
                    .where(TradeRaw.side == 'buy')
                    .where(TradeRaw.price < 0.40) 
                    .where(TradeRaw.amount * TradeRaw.price > 1000)
                    .order_by(desc(TradeRaw.amount * TradeRaw.price))
                    .limit(1)
                )
                
                # 3. Sniper
                stmt_sniper = (
                    select(TradeRaw, Market.title, WhaleStats.win_rate, WalletName.polymarket_username)
                    .join(WhaleStats, TradeRaw.wallet == WhaleStats.wallet_address)
                    .join(WhaleProfile, TradeRaw.wallet == WhaleProfile.wallet_address)
                    .outerjoin(Market, TradeRaw.market_id == Market.id)
                    .outerjoin(WalletName, TradeRaw.wallet == WalletName.wallet_address)
                    .where(TradeRaw.timestamp >= start_time)
                    .where(TradeRaw.side == 'buy')
                    .where(WhaleStats.win_rate >= 0.70)
                    .where(WhaleProfile.total_trades > 5)
                    .order_by(desc(TradeRaw.amount * TradeRaw.price))
                    .limit(1)
                )

                res_spender = await session.execute(stmt_spender)
                big_spender = res_spender.first()
                
                res_contrarian = await session.execute(stmt_contrarian)
                contrarian = res_contrarian.first()
                
                res_sniper = await session.execute(stmt_sniper)
                sniper = res_sniper.first()
        except Exception as e:
            print(f"Error connecting to database: {e}")
            print("\n💡 Tip: Run with --mock to see sample output without database connection.")
            return

    # Output Formatting (Shared logic)
    print("--- 🌟 Daily Alpha Spotlight 🌟 ---\n")
    
    if big_spender:
        trade, title, username = big_spender
        val = float(trade.amount) * float(trade.price)
        price_cents = float(trade.price) * 100
        name = username if username else f"{trade.wallet[:6]}...{trade.wallet[-4:]}"
        mkt_title = title if title else "Unknown Market"
        
        print(f"💰 **The Big Spender**")
        print(f"   WHO: {name}")
        print(f"   DID: Bought ${val:,.0f} of '{mkt_title}'")
        print(f"   AT:  {price_cents:.1f}¢")
        print(f"   📋 COPY THIS:")
        print(f"   \"Who just dropped ${val/1000:.1f}k on this? 🐳 Big money entering '{mkt_title[:40]}...' at {price_cents:.0f}¢. #Polymarket #WhaleAlert\"\n")
    else:
        print("💰 The Big Spender: No large trades found > 24h.\n")

    if contrarian:
        trade, title, username = contrarian
        val = float(trade.amount) * float(trade.price)
        price_cents = float(trade.price) * 100
        name = username if username else f"{trade.wallet[:6]}...{trade.wallet[-4:]}"
        mkt_title = title if title else "Unknown Market"

        print(f"🧠 **The Contrarian**")
        print(f"   WHO: {name}")
        print(f"   DID: Bet ${val:,.0f} on LOW ODDS (<40%)")
        print(f"   MKT: {mkt_title}")
        print(f"   AT:  {price_cents:.1f}¢")
        print(f"   📋 COPY THIS:")
        print(f"   \"Everyone is selling, but this whale is buying the dip. ${val/1000:.1f}k bet at {price_cents:.0f}% odds on '{mkt_title[:30]}...'. What do they know? 🤔 #Alpha #Contrarian\"\n")
    else:
        print("🧠 The Contrarian: No large contrarian bets found.\n")

    if sniper:
        trade, title, win_rate, username = sniper
        val = float(trade.amount) * float(trade.price)
        price_cents = float(trade.price) * 100
        name = username if username else f"{trade.wallet[:6]}...{trade.wallet[-4:]}"
        mkt_title = title if title else "Unknown Market"
        win_pct = win_rate * 100

        print(f"🎯 **The Sniper**")
        print(f"   WHO: {name} (Win Rate: {win_pct:.1f}%)")
        print(f"   DID: Entered '{mkt_title}'")
        print(f"   SIZE: ${val:,.0f}")
        print(f"   📋 COPY THIS:")
        print(f"   \"The {win_pct:.0f}% win-rate sniper just made a move. Tracking {name} on '{mkt_title[:30]}...' 🎯 Follow the smart money. #WhaleWatching\"\n")

if __name__ == "__main__":
    try:
        asyncio.run(get_daily_spotlight())
    except KeyboardInterrupt:
        print("\nAborted.")
