import asyncio
import os
import sys

from sqlalchemy import text

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from shared.db import engine


async def main() -> int:
    async with engine.connect() as conn:
        profiles = (
            await conn.execute(
                text(
                    """
                    select
                      count(*)::bigint as profiles,
                      sum((total_trades is not null)::int)::bigint as has_total_trades,
                      sum((total_volume is not null)::int)::bigint as has_total_volume,
                      sum((realized_pnl is not null)::int)::bigint as has_realized_pnl,
                      sum((wins is not null)::int)::bigint as has_wins,
                      sum((losses is not null)::int)::bigint as has_losses
                    from whale_profiles
                    """
                )
            )
        ).first()

        stats = (
            await conn.execute(
                text(
                    """
                    select
                      count(*)::bigint as stats_rows,
                      sum((whale_score is not null)::int)::bigint as has_whale_score,
                      sum((win_rate is not null)::int)::bigint as has_win_rate,
                      sum((roi is not null)::int)::bigint as has_roi,
                      sum((total_pnl is not null)::int)::bigint as has_total_pnl,
                      sum((avg_trade_size is not null)::int)::bigint as has_avg_trade_size,
                      sum((max_drawdown is not null)::int)::bigint as has_max_drawdown,
                      sum((stddev_pnl is not null)::int)::bigint as has_stddev_pnl,
                      sum((avg_entry_percentile is not null)::int)::bigint as has_avg_entry_percentile,
                      sum((avg_exit_percentile is not null)::int)::bigint as has_avg_exit_percentile,
                      sum((risk_reward_ratio is not null)::int)::bigint as has_risk_reward_ratio,
                      sum((market_liquidity_ratio is not null)::int)::bigint as has_market_liquidity_ratio
                    from whale_stats
                    """
                )
            )
        ).first()

    print(
        {
            "profiles": int(profiles.profiles or 0),
            "profiles_has_total_trades": int(profiles.has_total_trades or 0),
            "profiles_has_total_volume": int(profiles.has_total_volume or 0),
            "profiles_has_realized_pnl": int(profiles.has_realized_pnl or 0),
            "profiles_has_wins": int(profiles.has_wins or 0),
            "profiles_has_losses": int(profiles.has_losses or 0),
        }
    )
    print(
        {
            "stats_rows": int(stats.stats_rows or 0),
            "stats_has_whale_score": int(stats.has_whale_score or 0),
            "stats_has_win_rate": int(stats.has_win_rate or 0),
            "stats_has_roi": int(stats.has_roi or 0),
            "stats_has_total_pnl": int(stats.has_total_pnl or 0),
            "stats_has_avg_trade_size": int(stats.has_avg_trade_size or 0),
            "stats_has_max_drawdown": int(stats.has_max_drawdown or 0),
            "stats_has_stddev_pnl": int(stats.has_stddev_pnl or 0),
            "stats_has_avg_entry_percentile": int(stats.has_avg_entry_percentile or 0),
            "stats_has_avg_exit_percentile": int(stats.has_avg_exit_percentile or 0),
            "stats_has_risk_reward_ratio": int(stats.has_risk_reward_ratio or 0),
            "stats_has_market_liquidity_ratio": int(stats.has_market_liquidity_ratio or 0),
        }
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
