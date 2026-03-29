import asyncio
from collections import defaultdict
import os
import sys

from sqlalchemy import text

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from shared.db import engine


WINRATE_THRESHOLD = 0.55
LIMIT_WALLETS = 500
TOP_MARKETS_PER_WALLET = 8


SQL_WALLETS = text(
    """
    with last_hour_wallets as (
      select distinct wallet_address
      from whale_trade_history
      where timestamp >= (now() - interval '1 hour')
    ),
    lifetime as (
      select
        t.wallet_address,
        sum((t.pnl > 0)::int)::int as wins,
        sum((t.pnl < 0)::int)::int as losses,
        sum((t.pnl != 0)::int)::int as closed_trades,
        coalesce(sum(t.pnl), 0)::float as profit
      from whale_trade_history t
      join last_hour_wallets h on h.wallet_address = t.wallet_address
      group by t.wallet_address
    ),
    per_wallet as (
      select
        h.wallet_address as wallet_address,
        coalesce(p.total_trades, 0)::int as trades_total,
        coalesce(l.wins, 0)::int as wins,
        coalesce(l.losses, 0)::int as losses,
        coalesce(l.closed_trades, 0)::int as closed_trades,
        coalesce(l.profit, 0)::float as profit,
        case when (coalesce(l.wins, 0) + coalesce(l.losses, 0)) > 0
          then (coalesce(l.wins, 0)::float / (coalesce(l.wins, 0) + coalesce(l.losses, 0)))
          else 0
        end as winrate
      from last_hour_wallets h
      left join whale_profiles p on p.wallet_address = h.wallet_address
      left join lifetime l on l.wallet_address = h.wallet_address
    )
    select *
    from per_wallet
    where winrate > :winrate
    order by winrate desc, closed_trades desc, profit desc
    limit :limit_wallets;
    """
)


SQL_MARKETS = text(
    """
    with recent as (
      select wallet_address, market_id, pnl, trade_usd, timestamp
      from whale_trade_history
      where timestamp >= (now() - interval '1 hour')
    ),
    eligible as (
      select r.wallet_address as wallet_address
      from recent r
      left join whale_profiles p on p.wallet_address = r.wallet_address
      left join whale_stats s on s.wallet_address = r.wallet_address
      where coalesce(s.win_rate, case when (p.wins + p.losses) > 0 then (p.wins::float / (p.wins + p.losses)) else 0 end) > :winrate
    )
    select
      r.wallet_address,
      r.market_id,
      max(m.title) as market_title,
      count(*)::int as trades,
      coalesce(sum(r.trade_usd), 0)::float as volume_usd,
      coalesce(sum(r.pnl), 0)::float as pnl_usd
    from recent r
    join eligible e on e.wallet_address = r.wallet_address
    left join markets m on m.id = r.market_id
    group by r.wallet_address, r.market_id
    order by volume_usd desc;
    """
)


async def main() -> int:
    async with engine.connect() as conn:
        wallets = (
            await conn.execute(
                SQL_WALLETS,
                {"winrate": WINRATE_THRESHOLD, "limit_wallets": LIMIT_WALLETS},
            )
        ).fetchall()
        markets = (await conn.execute(SQL_MARKETS, {"winrate": WINRATE_THRESHOLD})).fetchall()

    by_wallet_markets: dict[str, list[tuple[str, int, float, float]]] = defaultdict(list)
    for r in markets:
        by_wallet_markets[str(r.wallet_address)].append(
            (str(r.market_title or r.market_id), int(r.trades), float(r.volume_usd), float(r.pnl_usd))
        )

    print(f"过去一小时有交易且（按历史已结算pnl）winrate > {WINRATE_THRESHOLD*100:.0f}% 的钱包数: {len(wallets)}")
    for w in wallets:
        wa = str(w.wallet_address)
        print(
            f"- {wa} | winrate={float(w.winrate):.3f} wins={int(w.wins)} losses={int(w.losses)} "
            f"closed={int(w.closed_trades)} trades={int(w.trades_total)} profit=${float(w.profit):.2f}"
        )
        mlist = sorted(by_wallet_markets.get(wa, []), key=lambda x: x[2], reverse=True)[:TOP_MARKETS_PER_WALLET]
        for title, trades, vol, pnl in mlist:
            print(f"  • {title} | trades={trades} vol=${vol:.0f} pnl=${pnl:.2f}")

    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
