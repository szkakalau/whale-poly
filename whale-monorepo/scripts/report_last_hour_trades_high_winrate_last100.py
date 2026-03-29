import asyncio
import os
import sys
from collections import defaultdict

from sqlalchemy import text

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from shared.db import engine


WINRATE_THRESHOLD = 0.55
LAST_N_SETTLED = 100
TOP_MARKETS_PER_WALLET = 10


SQL = text(
    """
    with last_hour_wallets as (
      select distinct wallet_address
      from whale_trade_history
      where timestamp >= (now() - interval '1 hour')
    ),
    settled_ranked as (
      select
        t.wallet_address,
        t.pnl,
        t.timestamp,
        row_number() over (partition by t.wallet_address order by t.timestamp desc) as rn
      from whale_trade_history t
      join last_hour_wallets h on h.wallet_address = t.wallet_address
      where t.pnl != 0
    ),
    last_n as (
      select *
      from settled_ranked
      where rn <= :last_n
    ),
    per_wallet as (
      select
        wallet_address,
        count(*)::int as settled_n,
        sum((pnl > 0)::int)::int as wins,
        sum((pnl < 0)::int)::int as losses,
        coalesce(sum(pnl), 0)::float as pnl_last_n,
        case
          when (sum((pnl > 0)::int) + sum((pnl < 0)::int)) > 0
            then (sum((pnl > 0)::int)::float / (sum((pnl > 0)::int) + sum((pnl < 0)::int)))
          else 0
        end as winrate_last_n
      from last_n
      group by wallet_address
    ),
    eligible as (
      select *
      from per_wallet
      where settled_n = :last_n
        and winrate_last_n > :winrate
    ),
    recent as (
      select wallet_address, market_id, pnl, trade_usd, timestamp
      from whale_trade_history
      where timestamp >= (now() - interval '1 hour')
    )
    select
      'wallet' as row_type,
      e.wallet_address,
      null::text as market_id,
      null::text as market_title,
      e.settled_n as trades,
      null::float as volume_usd,
      e.pnl_last_n as pnl_usd,
      e.winrate_last_n as winrate,
      e.wins as wins,
      e.losses as losses
    from eligible e

    union all

    select
      'market' as row_type,
      r.wallet_address,
      r.market_id::text as market_id,
      max(m.title)::text as market_title,
      count(*)::int as trades,
      coalesce(sum(r.trade_usd), 0)::float as volume_usd,
      coalesce(sum(r.pnl), 0)::float as pnl_usd,
      null::float as winrate,
      sum((r.pnl > 0)::int)::int as wins,
      sum((r.pnl < 0)::int)::int as losses
    from recent r
    join eligible e on e.wallet_address = r.wallet_address
    left join markets m on m.id = r.market_id
    group by r.wallet_address, r.market_id
    order by row_type desc, volume_usd desc;
    """
)


async def main() -> int:
    async with engine.connect() as conn:
        rows = (
            await conn.execute(
                SQL,
                {"winrate": WINRATE_THRESHOLD, "last_n": LAST_N_SETTLED},
            )
        ).fetchall()

    wallets = []
    markets_by_wallet: dict[str, list[dict]] = defaultdict(list)

    for r in rows:
        if r.row_type == "wallet":
            wallets.append(
                {
                    "wallet": str(r.wallet_address),
                    "winrate_last_n": float(r.winrate),
                    "wins": int(r.wins),
                    "losses": int(r.losses),
                    "pnl_last_n": float(r.pnl_usd),
                }
            )
        else:
            markets_by_wallet[str(r.wallet_address)].append(
                {
                    "market_title": (r.market_title or r.market_id),
                    "market_id": r.market_id,
                    "trades": int(r.trades),
                    "volume_usd": float(r.volume_usd or 0),
                    "pnl_usd": float(r.pnl_usd or 0),
                }
            )

    wallets.sort(key=lambda x: (-x["winrate_last_n"], -x["pnl_last_n"]))

    print(
        {
            "wallets_last_hour_high_winrate_last100": len(wallets),
            "winrate_threshold": WINRATE_THRESHOLD,
            "last_n_settled": LAST_N_SETTLED,
        }
    )

    for w in wallets:
        wa = w["wallet"]
        print(
            f"\n- {wa} | winrate(last{LAST_N_SETTLED})={w['winrate_last_n']:.3f} "
            f"({w['wins']}-{w['losses']}) pnl_last{LAST_N_SETTLED}=${w['pnl_last_n']:.2f}"
        )
        ms = sorted(markets_by_wallet.get(wa, []), key=lambda x: x["volume_usd"], reverse=True)
        for m in ms[:TOP_MARKETS_PER_WALLET]:
            print(
                f"  • {m['market_title']} | trades={m['trades']} vol=${m['volume_usd']:.0f} pnl=${m['pnl_usd']:.2f}"
            )

    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

