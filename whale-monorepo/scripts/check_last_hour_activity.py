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
                    "select count(*)::bigint as trades, count(distinct wallet_address)::bigint as wallets "
                    "from whale_trade_history where timestamp >= (now() - interval '1 hour')"
                )
            )
        ).first()
    print({"trades": int(row.trades or 0), "wallets": int(row.wallets or 0)})
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
