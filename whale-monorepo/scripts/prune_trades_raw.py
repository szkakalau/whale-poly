"""Prune trades_raw rows older than RETENTION_DAYS, in small batches.

Indexed paths only (ix_trades_raw_timestamp for selection, pkey for delete).
Safe to re-run; defaults to dry run unless --apply is passed.
After a big prune, run: VACUUM ANALYZE trades_raw
"""
import asyncio
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import asyncpg

RETENTION_DAYS = 90
BATCH = 10000
STATEMENT_TIMEOUT_MS = 180000


async def main() -> None:
    apply = "--apply" in sys.argv
    env_text = Path(".env").read_text(encoding="utf-8")
    raw = re.search(r"^DATABASE_URL=(.+)$", env_text, re.M).group(1).strip()
    raw = raw.replace("postgresql://", "").replace("postgres://", "")
    creds, rest = raw.split("@", 1)
    user, password = creds.split(":", 1)
    host_port, db_q = rest.split("/", 1)
    db = db_q.split("?")[0]
    host, _, port = host_port.partition(":")
    conn = await asyncpg.connect(user=user, password=password, host=host,
                                 port=int(port or 5432), database=db,
                                 ssl="require", timeout=15)
    await conn.execute(f"SET statement_timeout = 300000")  # count may be slow
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    print(f"cutoff: {cutoff.isoformat()} (retention {RETENTION_DAYS}d)"
          f" | apply={apply}")

    total_old = await conn.fetchval(
        "SELECT count(*) FROM trades_raw WHERE timestamp < $1", cutoff
    )
    print(f"rows older than cutoff: {total_old}")
    if not apply:
        print("DRY RUN — pass --apply to delete.")
        await conn.close()
        return

    await conn.execute(f"SET statement_timeout = {STATEMENT_TIMEOUT_MS}")

    deleted = 0
    while True:
        # Single statement: select a bounded window of stale ids and delete
        # them in one go. Uses ix_trades_raw_timestamp for the subquery and
        # the pkey for the delete — no seq scans.
        res = await conn.execute(
            "DELETE FROM trades_raw WHERE trade_id IN ("
            "  SELECT trade_id FROM trades_raw WHERE timestamp < $1 "
            "  ORDER BY timestamp LIMIT $2"
            ")",
            cutoff, BATCH,
        )
        n = int(res.split()[-1])
        if n == 0:
            break
        deleted += n
        if deleted % 200000 < BATCH:
            print(f"deleted {deleted}/{total_old} ...")
        await asyncio.sleep(0.1)
    print(f"PRUNE DONE — deleted {deleted} rows")
    await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
