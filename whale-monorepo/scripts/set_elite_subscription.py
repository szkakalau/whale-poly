import argparse
import asyncio
import os
import sys

from sqlalchemy import text

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from shared.db import engine


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--telegram-id", required=True)
    parser.add_argument("--days", type=int, default=365)
    return parser.parse_args()


async def main() -> int:
    args = parse_args()
    async with engine.connect() as conn:
        params = {"tid": str(args.telegram_id), "days": int(args.days)}
        result = await conn.execute(
            text(
                """
                update subscriptions
                set status = 'active',
                    plan = 'elite',
                    current_period_end = now() + make_interval(days => :days)
                where telegram_id = :tid
                """
            ),
            params,
        )
        if result.rowcount == 0:
            await conn.execute(
                text(
                    """
                    insert into subscriptions (id, telegram_id, status, plan, current_period_end)
                    values (gen_random_uuid(), :tid, 'active', 'elite', now() + make_interval(days => :days))
                    """
                ),
                params,
            )
        await conn.commit()
    print("subscription upserted")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
