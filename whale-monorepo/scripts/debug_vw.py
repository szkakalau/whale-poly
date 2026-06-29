"""Raw VW compute test — bypasses try/except to surface errors."""
import asyncio
from decimal import Decimal
from datetime import datetime, timezone

from sqlalchemy import text
from shared.db import SessionLocal, settings
from shared.config import get_alert_config
from redis.asyncio import Redis
from services.whale_engine.vw import (
    _calc_vw_prices, _calc_divergence, _calc_uai,
    _determine_signal, _get_market_price
)


async def raw_compute():
    config = get_alert_config().get('vw_analysis', {})
    window_days = config.get('computation_window_days', 7)
    min_24h = config.get('min_24h_volume_usd', 10000)
    redis = Redis.from_url(settings.redis_url, decode_responses=True)

    try:
        async with SessionLocal() as s:
            # 1. Find active market
            r = await s.execute(text(f"""
                WITH vol_24h AS (
                    SELECT market_id, SUM(amount * price) AS vol
                    FROM trades_raw WHERE timestamp > NOW() - INTERVAL '24 hours'
                    GROUP BY market_id
                )
                SELECT DISTINCT t.market_id, COALESCE(v.vol, 0) AS vol_24h
                FROM trades_raw t JOIN markets m ON t.market_id = m.id
                LEFT JOIN vol_24h v ON t.market_id = v.market_id
                WHERE t.timestamp > NOW() - INTERVAL '1 hour'
                  AND (m.status IS NULL OR m.status != 'closed')
                  AND COALESCE(v.vol, 0) >= 1000
            """))
            markets = r.fetchall()
            print(f'Active markets (1h window, 24h_vol>=$1000): {len(markets)}')
            if not markets:
                # Fallback: any market with $10k+ 24h vol, regardless of recency
                r2 = await s.execute(text("""
                    SELECT market_id, SUM(amount * price) AS vol
                    FROM trades_raw
                    WHERE timestamp > NOW() - INTERVAL '24 hours'
                    GROUP BY market_id
                    HAVING SUM(amount * price) >= 10000
                    ORDER BY vol DESC LIMIT 3
                """))
                markets = r2.fetchall()
                print(f'Fallback (any 24h_vol>=$10k): {len(markets)} markets')
            if not markets:
                print('No high-volume markets at all.')
                return
            mid = markets[0][0]

            # 2. Trades
            r = await s.execute(text(f"""
                SELECT outcome, amount, price FROM trades_raw
                WHERE market_id = :mid
                  AND timestamp > NOW() - INTERVAL '{window_days} days'
            """), {'mid': mid})
            trades = [(row[0], row[1], row[2]) for row in r.fetchall()]
            print(f'Trades: {len(trades)}')

            vw = _calc_vw_prices(trades)
            print(f'VW: yes_vw={vw["yes_vw_price"]}, no_vw={vw["no_vw_price"]}')
            print(f'Vol: yes_usd={vw["yes_volume_usd"]}, no_usd={vw["no_volume_usd"]}')

            # 3. Price
            price = await _get_market_price(s, mid)
            print(f'YES price: {price}')

            # 4. Metrics
            div = _calc_divergence(vw['yes_vw_price'], vw['no_vw_price'], price)
            uai = _calc_uai(vw['yes_vw_price'], vw['no_vw_price'], price, Decimal('0.02'))
            sd, ss = _determine_signal(div, Decimal('0.10'))
            total_vol = vw['yes_volume_usd'] + vw['no_volume_usd']
            status = 'active' if total_vol >= 50000 else 'dormant'
            print(f'div={div}, uai={uai}, signal={sd}/{ss}, status={status}, total_vol={total_vol}')

            # 5. Write
            now = datetime.now(timezone.utc)
            await s.execute(text("""
                INSERT INTO market_vw_metrics (
                    market_id, total_volume_usd, yes_volume_usd, no_volume_usd,
                    yes_vw_price, no_vw_price, yes_market_price, no_market_price,
                    vw_divergence, uai, signal_direction, signal_strength,
                    status, computed_at
                ) VALUES (
                    :mid, :tv, :yv, :nv, :yvp, :nvp, :ymp, :nmp,
                    :div, :uai, :sd, :ss, :st, :now
                )
                ON CONFLICT (market_id) DO UPDATE SET
                    total_volume_usd = EXCLUDED.total_volume_usd,
                    yes_vw_price = EXCLUDED.yes_vw_price,
                    no_vw_price = EXCLUDED.no_vw_price,
                    vw_divergence = EXCLUDED.vw_divergence,
                    uai = EXCLUDED.uai,
                    signal_direction = EXCLUDED.signal_direction,
                    signal_strength = EXCLUDED.signal_strength,
                    status = EXCLUDED.status,
                    computed_at = EXCLUDED.computed_at
            """), {
                'mid': mid, 'tv': total_vol, 'yv': vw['yes_volume_usd'],
                'nv': vw['no_volume_usd'], 'yvp': vw['yes_vw_price'],
                'nvp': vw['no_vw_price'], 'ymp': price,
                'nmp': Decimal('1') - price, 'div': div, 'uai': uai,
                'sd': sd, 'ss': ss, 'st': status, 'now': now
            })
            print('UPSERT metrics OK')

            await s.execute(text("""
                INSERT INTO market_vw_snapshots (
                    market_id, vw_divergence, uai,
                    yes_vw_price, no_vw_price, yes_market_price,
                    total_volume_usd, snapshot_at
                ) VALUES (:mid, :div, :uai, :yvp, :nvp, :ymp, :tv, :now)
            """), {
                'mid': mid, 'div': div, 'uai': uai, 'yvp': vw['yes_vw_price'],
                'nvp': vw['no_vw_price'], 'ymp': price, 'tv': total_vol, 'now': now
            })
            print('INSERT snapshot OK')

            await s.commit()
            print('COMMIT OK')

    finally:
        await redis.aclose()


if __name__ == '__main__':
    asyncio.run(raw_compute())
