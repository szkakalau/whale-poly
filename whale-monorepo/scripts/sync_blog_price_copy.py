"""Sync blog pricing copy in Postgres to the canonical $29/$59 system.

Replaces legacy price strings (the earlier $99 / $49 / $29–$99 copy) in the
`content` column of `blog_posts` with the canonical marketing prices, so the
live site and the offline editing workspace
(services/landing/src/content/posts/) stay consistent with the single source of
truth (services/landing/src/lib/pricing-plans.ts).

Usage (Render Shell, DATABASE_URL already configured):
    cd whale-poly/whale-monorepo
    python scripts/sync_blog_price_copy.py

Order of replacements matters: ``$99/month`` must run before ``$99/mo`` so the
longer ``/month`` variant is not partially rewritten into ``/nth``.
"""

from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

# Add the monorepo root to the import path so `shared.*` resolves when run
# directly from Render Shell.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shared.config import settings  # noqa: E402
from shared.db import SessionLocal  # noqa: E402
from sqlalchemy import text  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("sync_blog_price_copy")

# (old, new) string pairs, in the exact order they must be applied.
# Canonical prices: Pro $29/mo / $290/yr, Elite $59/mo / $590/yr.
REPLACEMENTS: list[tuple[str, str]] = [
    ("$99/month", "$59/month"),
    ("$99/mo", "$59/mo"),
    ("$49/mo", "$29/mo"),
    ("$29–$99/month", "$29–$59/month"),
    ("$29–$99", "$29–$59"),
]


async def main() -> None:
    async with SessionLocal() as session:
        total = 0
        for old, new in REPLACEMENTS:
            result = await session.execute(
                text(
                    "update blog_posts "
                    "set content = replace(content, :old, :new) "
                    "where content like :pattern"
                ),
                {"old": old, "new": new, "pattern": f"%{old}%"},
            )
            affected = result.rowcount or 0
            total += affected
            logger.info("replaced %-14r -> %-14r : %d row(s)", old, new, affected)

        await session.commit()
        logger.info("committed — %d total row(s) updated", total)


if __name__ == "__main__":
    asyncio.run(main())
