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
                    ),
                    joined as (
                      select
                        h.wallet_address,
                        p.wins,
                        p.losses,
                        case when (coalesce(p.wins,0) + coalesce(p.losses,0)) > 0
                          then (coalesce(p.wins,0)::float / (coalesce(p.wins,0) + coalesce(p.losses,0)))
                          else 0
                        end as winrate
                      from last_hour_wallets h
                      left join whale_profiles p on p.wallet_address = h.wallet_address
                    )
                    select
                      count(*)::bigint as wallets_last_hour,
                      sum((wins is not null or losses is not null)::int)::bigint as wallets_with_profile,
                      sum(((coalesce(wins,0)+coalesce(losses,0))>0)::int)::bigint as wallets_with_closed,
                      sum((winrate > 0.55)::int)::bigint as profile_winrate_gt_55
                    from joined
                    """
                )
            )
        ).first()
    print(
        {
            "wallets_last_hour": int(row.wallets_last_hour or 0),
            "wallets_with_profile": int(row.wallets_with_profile or 0),
            "wallets_with_closed": int(row.wallets_with_closed or 0),
            "profile_winrate_gt_55": int(row.profile_winrate_gt_55 or 0),
        }
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

