"""Debug VW metrics computation step by step."""
import asyncio
import traceback
from decimal import Decimal

from sqlalchemy import text
from shared.db import SessionLocal
from shared.config import get_alert_config, settings
from redis.asyncio import Redis


async def step1():
    """Check config."""
    config = get_alert_config().get("vw_analysis", {})
    print(f"Full config: {config}")
    print(f"min_24h_volume_usd: {config.get('min_24h_volume_usd')} ({type(config.get('min_24h_volume_usd'))})")
    window_days = config.get("computation_window_days", 7)
    print(f"window_days: {window_days}")
    return config


async def step2(config):
    """Run active markets query."""
    min_24h_vol = str(config.get("min_24h_volume_usd", 10000))
    print(f"\nStep 2: min_24h_vol = {min_24h_vol}")

    async with SessionLocal() as s:
        r = await s.execute(
            text(f"""
                WITH vol_24h AS (
                    SELECT market_id, SUM(amount * price) AS vol
                    FROM trades_raw
                    WHERE timestamp > NOW() - INTERVAL '24 hours'
                    GROUP BY market_id
                )
                SELECT DISTINCT t.market_id, COALESCE(v.vol, 0) AS vol_24h
                FROM trades_raw t
                JOIN markets m ON t.market_id = m.id
                LEFT JOIN vol_24h v ON t.market_id = v.market_id
                WHERE t.timestamp > NOW() - INTERVAL '10 minutes'
                  AND (m.status IS NULL OR m.status != 'closed')
                  AND COALESCE(v.vol, 0) >= {min_24h_vol}
            """)
        )
        rows = r.fetchall()
        print(f"Active markets: {len(rows)}")
        for row in rows[:3]:
            print(f"  mid={row[0][:50]}... vol_24h={row[1]}")
        return rows


async def step3(config, markets):
    """Try processing the first market."""
    if not markets:
        print("No markets to process!")
        return

    window_days = config.get("computation_window_days", 7)
    mid = markets[0][0]
    print(f"\nStep 3: Processing market {mid[:60]}...")
    print(f"  window_days={window_days}")

    async with SessionLocal() as s:
        # Get trades
        try:
            r = await s.execute(
                text(f"""
                    SELECT outcome, amount, price
                    FROM trades_raw
                    WHERE market_id = :mid
                      AND timestamp > NOW() - INTERVAL '{window_days} days'
                """),
                {"mid": mid},
            )
            trades = [(row[0], row[1], row[2]) for row in r.fetchall()]
            print(f"  Trades in window: {len(trades)}")
            if trades:
                print(f"  First: outcome={trades[0][0]}, amount={trades[0][1]}, price={trades[0][2]}")
        except Exception as e:
            print(f"  TRADE QUERY ERROR: {e}")
            traceback.print_exc()

        # Get market price
        try:
            r = await s.execute(
                text("""
                    SELECT price FROM trades_raw
                    WHERE market_id = :mid AND outcome = 'Yes'
                    ORDER BY timestamp DESC LIMIT 1
                """),
                {"mid": mid},
            )
            row = r.fetchone()
            if row:
                print(f"  YES price: {row[0]}")
            else:
                # Try NO fallback
                r = await s.execute(
                    text("""
                        SELECT price FROM trades_raw
                        WHERE market_id = :mid AND outcome = 'No'
                        ORDER BY timestamp DESC LIMIT 1
                    """),
                    {"mid": mid},
                )
                row = r.fetchone()
                if row:
                    print(f"  NO price: {row[0]}, derived YES: {Decimal('1') - row[0]}")
                else:
                    print("  No price found at all!")
        except Exception as e:
            print(f"  PRICE QUERY ERROR: {e}")
            traceback.print_exc()


async def main():
    print("=== VW Debug ===")
    config = await step1()
    markets = await step2(config)
    await step3(config, markets)
    print("=== Done ===")


if __name__ == "__main__":
    asyncio.run(main())
