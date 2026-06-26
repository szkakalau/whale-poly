"""Insert the Smart Money / Whale Score pillar article into blog_posts.

Usage:
    cd whale-poly/whale-monorepo
    python scripts/insert_blog_post.py
"""

from __future__ import annotations

import asyncio
import logging
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shared.config import settings
from shared.db import SessionLocal
from sqlalchemy import text

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("insert_blog_post")

POSTS_DIR = Path("services/landing/src/content/posts")

EN_FILE = POSTS_DIR / "how-to-identify-profitable-polymarket-traders-using-onchain-data.md"
ZH_FILE = POSTS_DIR / "how-to-identify-profitable-polymarket-traders-using-onchain-data-zh.md"


def parse_frontmatter(path: Path) -> dict:
    """Parse YAML frontmatter from a markdown file."""
    content = path.read_text(encoding="utf-8")
    if not content.startswith("---"):
        raise ValueError(f"No frontmatter found in {path}")

    parts = content.split("---", 2)
    if len(parts) < 3:
        raise ValueError(f"Malformed frontmatter in {path}")

    # Simple YAML parser — avoids pyyaml dependency
    meta = {}
    for line in parts[1].strip().split("\n"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" in line:
            key, _, value = line.partition(":")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            # Handle list values like [tag1, tag2]
            if value.startswith("[") and value.endswith("]"):
                value = [
                    v.strip().strip('"').strip("'")
                    for v in value[1:-1].split(",")
                    if v.strip()
                ]
            meta[key] = value

    body = parts[2].strip()
    return {**meta, "content": body}


async def main():
    en_meta = parse_frontmatter(EN_FILE)
    zh_meta = parse_frontmatter(ZH_FILE)

    group_slug = "polymarket-smart-money-whale-score-guide"
    now_utc = datetime.now(timezone.utc)

    async with SessionLocal() as session:
        # Ensure table exists
        await session.execute(
            text(
                """create table if not exists blog_posts (
                    id text primary key,
                    slug text not null,
                    title text not null,
                    excerpt text not null,
                    content text not null,
                    author text not null,
                    read_time text not null,
                    cover_image text,
                    tags text[] default '{}',
                    published_at timestamptz not null,
                    created_at timestamptz not null default now(),
                    updated_at timestamptz not null default now(),
                    language text not null default 'en',
                    group_slug text,
                    status text not null default 'published'
                )"""
            )
        )
        # Ensure unique index
        try:
            await session.execute(
                text("create unique index if not exists blog_posts_slug_language_idx on blog_posts (slug, language)")
            )
        except Exception:
            pass
        await session.commit()

        posts = [
            (en_meta, "en", "how-to-identify-profitable-polymarket-traders-using-onchain-data"),
            (zh_meta, "zh", "how-to-identify-profitable-polymarket-traders-using-onchain-data-zh"),
        ]

        for meta, lang, slug in posts:
            post_id = str(uuid.uuid4())
            tags = meta.get("tags", [])
            if isinstance(tags, str):
                tags = [t.strip() for t in tags.split(",")]

            await session.execute(
                text(
                    """insert into blog_posts (id, slug, title, excerpt, content, author, read_time, tags, published_at, created_at, updated_at, language, group_slug, status)
                    values (:id, :slug, :title, :excerpt, :content, :author, :read_time, :tags, :published_at, :created_at, :updated_at, :language, :group_slug, :status)
                    on conflict (slug, language) do update set
                        title=excluded.title, excerpt=excluded.excerpt, content=excluded.content,
                        author=excluded.author, read_time=excluded.read_time, tags=excluded.tags,
                        updated_at=excluded.updated_at"""
                ),
                {
                    "id": post_id,
                    "slug": slug,
                    "title": meta["title"],
                    "excerpt": meta.get("excerpt", meta.get("metaDescription", "")),
                    "content": meta["content"],
                    "author": meta.get("author", "SightWhale"),
                    "read_time": meta.get("readTime", meta.get("read_time", "8 min")),
                    "tags": tags,
                    "published_at": now_utc,
                    "created_at": now_utc,
                    "updated_at": now_utc,
                    "language": lang,
                    "group_slug": group_slug,
                    "status": "published",
                },
            )
            logger.info("Inserted %s post: slug=%s", lang, slug)

        await session.commit()

    logger.info("Done! EN + ZH posts inserted.")
    print("\n=== Insert Summary ===")
    print(f"EN: {en_meta['title']}")
    print(f"ZH: {zh_meta['title']}")
    print(f"Group slug: {group_slug}")
    print(f"EN URL: https://www.sightwhale.com/blog/en/{posts[0][2]}")
    print(f"ZH URL: https://www.sightwhale.com/blog/zh/{posts[1][2]}")


if __name__ == "__main__":
    asyncio.run(main())
