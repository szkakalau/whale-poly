import asyncio
import os
import sys

from sqlalchemy import text

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from shared.db import engine


async def main() -> int:
    async with engine.connect() as conn:
        row = (
            await conn.execute(
                text(
                    """
                    with last_hour_wallets as (
                      select distinct wallet_address
                      from whale_trade_history
                      where timestamp >= (now() - interval '1 hour')
                    )
                    select
                      count(*)::bigint as wallets_last_hour,
                      sum((s.wallet_address is not null)::int)::bigint as wallets_with_stats,
                      sum((coalesce(s.win_rate, 0) > 0.55)::int)::bigint as stats_winrate_gt_55
                    from last_hour_wallets h
                    left join whale_stats s on s.wallet_address = h.wallet_address
                    """
                )
            )
        ).first()

        top = (
            await conn.execute(
                text(
                    """
                    with last_hour_wallets as (
                      select distinct wallet_address
                      from whale_trade_history
                      where timestamp >= (now() - interval '1 hour')
                    )
                    select h.wallet_address, s.win_rate
                    from last_hour_wallets h
                    join whale_stats s on s.wallet_address = h.wallet_address
                    order by s.win_rate desc
                    limit 20
                    """
                )
            )
        ).fetchall()

    print(
        {
            "wallets_last_hour": int(row.wallets_last_hour or 0),
            "wallets_with_stats": int(row.wallets_with_stats or 0),
            "stats_winrate_gt_55": int(row.stats_winrate_gt_55 or 0),
            "top_stats": [(str(r.wallet_address), float(r.win_rate)) for r in top],
        }
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

