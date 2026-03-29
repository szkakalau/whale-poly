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
                    select
                      (select count(*)::bigint from trades_raw tr where tr.wallet in (select wallet_address from whale_profiles)) as raw_for_whales,
                      (select count(*)::bigint from whale_trade_history) as history_total,
                      (select sum((pnl!=0)::int)::bigint from whale_trade_history) as history_nonzero
                    """
                )
            )
        ).first()

    print(
        {
            "raw_for_whales": int(row.raw_for_whales or 0),
            "history_total": int(row.history_total or 0),
            "history_nonzero": int(row.history_nonzero or 0),
        }
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
