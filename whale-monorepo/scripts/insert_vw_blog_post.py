"""Insert the VW Analysis blog post directly into the database (sync).

Usage:
    cd whale-poly/whale-monorepo
    python scripts/insert_vw_blog_post.py
"""

from __future__ import annotations

import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import psycopg2
import psycopg2.extras

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("insert_vw_blog_post")

REPO_ROOT = Path(__file__).resolve().parent.parent
POSTS_DIR = Path("services/landing/src/content/posts")
EN_FILE = POSTS_DIR / "polymarket-volume-weighted-price-analysis.md"

# Load .env
_ENV_PATH = REPO_ROOT / ".env"
if _ENV_PATH.exists():
    for _line in _ENV_PATH.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _key, _, _val = _line.partition("=")
            os.environ.setdefault(_key.strip(), _val.strip().strip('"').strip("'"))

DATABASE_URL = os.getenv("DATABASE_URL", "")


def parse_frontmatter(path: Path) -> dict:
    content = path.read_text(encoding="utf-8")
    if not content.startswith("---"):
        raise ValueError(f"No frontmatter found in {path}")
    parts = content.split("---", 2)
    if len(parts) < 3:
        raise ValueError(f"Malformed frontmatter in {path}")
    meta = {}
    for line in parts[1].strip().split("\n"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" in line:
            key, _, value = line.partition(":")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if value.startswith("[") and value.endswith("]"):
                value = [
                    v.strip().strip('"').strip("'")
                    for v in value[1:-1].split(",")
                    if v.strip()
                ]
            meta[key] = value
    body = parts[2].strip()
    return {**meta, "content": body}


def main():
    if not DATABASE_URL:
        logger.error("DATABASE_URL not set")
        sys.exit(1)

    meta = parse_frontmatter(EN_FILE)
    slug = "polymarket-volume-weighted-price-analysis"
    now_utc = datetime.now(timezone.utc)

    logger.info("Connecting to PostgreSQL...")
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False

    try:
        with conn.cursor() as cur:
            # Ensure table exists
            cur.execute(
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
            # Ensure unique index
            try:
                cur.execute(
                    "create unique index if not exists blog_posts_slug_language_idx on blog_posts (slug, language)"
                )
            except Exception:
                conn.rollback()
            conn.commit()

            post_id = str(uuid.uuid4())
            tags = meta.get("tags", [])
            if isinstance(tags, str):
                tags = [t.strip() for t in tags.split(",")]

            cur.execute(
                """insert into blog_posts (id, slug, title, excerpt, content, author, read_time, tags, published_at, created_at, updated_at, language, group_slug, status)
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                on conflict (slug, language) do update set
                    title=excluded.title, excerpt=excluded.excerpt, content=excluded.content,
                    author=excluded.author, read_time=excluded.read_time, tags=excluded.tags,
                    updated_at=excluded.updated_at""",
                (
                    post_id,
                    slug,
                    meta["title"],
                    meta.get("excerpt", ""),
                    meta["content"],
                    meta.get("author", "SightWhale"),
                    "6 min",
                    tags,
                    now_utc,
                    now_utc,
                    now_utc,
                    "en",
                    "polymarket-volume-weighted-analysis",
                    "published",
                ),
            )

        conn.commit()
        logger.info("Inserted EN post: slug=%s", slug)

    finally:
        conn.close()

    logger.info("Done!")
    print("\n=== Insert Summary ===")
    print(f"Title: {meta['title']}")
    print(f"Slug: {slug}")
    print(f"URL: https://www.sightwhale.com/blog/en/{slug}")


if __name__ == "__main__":
    main()
