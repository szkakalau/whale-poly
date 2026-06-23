"""One-time migration: score and import 138 existing blog posts into the blog_posts table.

Usage:
    cd whale-poly/whale-monorepo
    python scripts/migrate_blog_posts.py

Requires: DATABASE_URL, BLOG_LLM_API_KEY env vars (reads from .env via shared.config).
Installs needed: pip install openai pyyaml python-dotenv
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Add monorepo root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from openai import OpenAI
from shared.config import settings
from shared.db import SessionLocal, engine
from sqlalchemy import text

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("migrate_blog")

POSTS_DIR = Path("services/landing/src/content/posts")
REJECTED_DIR = POSTS_DIR / "_rejected"
SCORES_FILE = Path("scripts/.migrate_scores.json")
SCORE_THRESHOLD = 6
TRANSLATE_THRESHOLD = 8
BATCH_SIZE = 10  # Score N posts per LLM call


def list_posts() -> list[Path]:
    """Discover all .md files in the posts directory."""
    if not POSTS_DIR.exists():
        logger.error("Posts directory not found: %s", POSTS_DIR)
        sys.exit(1)
    return sorted(POSTS_DIR.glob("*.md"))


def parse_frontmatter(path: Path) -> dict:
    """Parse YAML frontmatter from a markdown file."""
    content = path.read_text(encoding="utf-8")
    if not content.startswith("---"):
        return {"title": path.stem, "content": content, "excerpt": "", "author": "Whale Team", "tags": []}

    parts = content.split("---", 2)
    if len(parts) < 3:
        return {"title": path.stem, "content": content, "excerpt": "", "author": "Whale Team", "tags": []}

    try:
        import yaml
        meta = yaml.safe_load(parts[1]) or {}
    except Exception:
        meta = {}

    body = parts[2].strip()
    return {
        "title": meta.get("title", path.stem.replace("-", " ").title()),
        "excerpt": meta.get("excerpt", ""),
        "content": body,
        "author": meta.get("author", "Whale Team"),
        "tags": meta.get("tags", []),
        "date": meta.get("date", ""),
        "read_time": meta.get("readTime", "5 min"),
    }


def score_posts(posts: list[tuple[Path, dict]]) -> dict[str, int]:
    """Batch score posts using DeepSeek. Returns {filename: score}.

    Saves scores to SCRIPTS_DIR/.migrate_scores.json for resume support.
    """
    client = OpenAI(api_key=settings.blog_llm_api_key, base_url=settings.blog_llm_base_url)

    scores: dict[str, int] = {}
    total = len(posts)

    for batch_start in range(0, total, BATCH_SIZE):
        batch = posts[batch_start : batch_start + BATCH_SIZE]
        items = []
        for path, meta in batch:
            # Truncate content to first 500 chars for scoring
            preview = meta["content"][:500]
            items.append({
                "file": path.name,
                "title": meta["title"],
                "excerpt": meta.get("excerpt", "")[:200],
                "preview": preview,
            })

        prompt = f"""You are scoring blog articles for quality on a 1-10 scale for the SightWhale.com blog about Polymarket and prediction markets.

Score each article on:
- SEO title quality (compelling, keyword-rich)
- Content depth (substantive analysis vs thin/fluff)
- Data density (real numbers, examples, concrete details)
- Timeliness (is the content still relevant or is it dated news?)

BATCH OF {len(items)} ARTICLES:
{json.dumps(items, indent=2)}

Return a JSON object mapping filename to score (1-10 integer):
{{"filename.md": 8, "other.md": 4, ...}}

Output ONLY the JSON object, no other text."""

        try:
            response = client.chat.completions.create(
                model=settings.blog_llm_model,
                messages=[
                    {"role": "system", "content": "You score articles. Output only JSON."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
                max_tokens=2048,
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content
            batch_scores = json.loads(raw or "{}")
            scores.update(batch_scores)
            logger.info("Scored batch %d/%d: %d posts", batch_start // BATCH_SIZE + 1, (total + BATCH_SIZE - 1) // BATCH_SIZE, len(batch_scores))
        except Exception as e:
            logger.error("Scoring batch failed: %s — defaulting to score=5", e)
            for path, _ in batch:
                scores[path.name] = 5

    # Save scores for resume support
    try:
        SCORES_FILE.parent.mkdir(parents=True, exist_ok=True)
        SCORES_FILE.write_text(json.dumps(scores, indent=2))
        logger.info("Saved scores to %s", SCORES_FILE)
    except Exception:
        pass

    return scores


async def migrate_posts(
    posts: list[tuple[Path, dict]],
    scores: dict[str, int],
    translate: set[str],
) -> dict:
    """Insert scored posts into blog_posts table. Returns stats."""
    stats = {"imported": 0, "rejected": 0, "translated": 0}

    async with SessionLocal() as session:
        # Ensure table exists
        await session.execute(
            text(
                """create table if not exists blog_posts (
                    id text primary key, slug text not null, title text not null,
                    excerpt text not null, content text not null, author text not null,
                    read_time text not null, cover_image text, tags text[] default '{}',
                    published_at timestamptz not null, created_at timestamptz not null default now(),
                    updated_at timestamptz not null default now(),
                    language text not null default 'en', group_slug text,
                    status text not null default 'published', generation_prompt text
                )"""
            )
        )
        # Migrate existing table: add columns that may not exist
        for col, col_def in [
            ("language", "text not null default 'en'"),
            ("group_slug", "text"),
            ("status", "text not null default 'published'"),
            ("generation_prompt", "text"),
        ]:
            try:
                await session.execute(
                    text(f"alter table blog_posts add column if not exists {col} {col_def}")
                )
            except Exception:
                pass
        # Drop old unique constraint on slug alone, create new one on (slug, language)
        try:
            await session.execute(text("alter table blog_posts drop constraint if exists blog_posts_slug_key"))
        except Exception:
            pass
        try:
            await session.execute(text("create unique index if not exists blog_posts_slug_language_idx on blog_posts (slug, language)"))
        except Exception:
            pass
        await session.commit()

        for path, meta in posts:
            score = scores.get(path.name, 5)

            if score < SCORE_THRESHOLD:
                REJECTED_DIR.mkdir(parents=True, exist_ok=True)
                shutil.move(str(path), str(REJECTED_DIR / path.name))
                stats["rejected"] += 1
                logger.info("[REJECT %d] %s", score, path.name)
                continue

            # Create slug from filename
            slug = path.stem[:80]
            group_slug = f"migrated-{path.stem[:60]}"
            now = datetime.now(timezone.utc)
            published_at = now
            if meta.get("date"):
                try:
                    published_at = datetime.fromisoformat(meta["date"]).replace(tzinfo=timezone.utc)
                except Exception:
                    pass

            post_id = str(uuid.uuid4())
            await session.execute(
                text(
                    """insert into blog_posts (id, slug, title, excerpt, content, author, read_time, tags, published_at, created_at, updated_at, language, group_slug, status)
                    values (:id, :slug, :title, :excerpt, :content, :author, :read_time, :tags, :published_at, :created_at, :updated_at, :language, :group_slug, :status)
                    on conflict (slug, language) do update set
                        title=excluded.title, excerpt=excluded.excerpt, content=excluded.content,
                        author=excluded.author, read_time=excluded.read_time, tags=excluded.tags, updated_at=excluded.updated_at"""
                ),
                {
                    "id": post_id, "slug": slug, "title": meta["title"],
                    "excerpt": meta["excerpt"] or meta["content"][:160],
                    "content": meta["content"], "author": meta["author"],
                    "read_time": meta.get("read_time", "5 min"),
                    "tags": meta.get("tags", []), "published_at": published_at,
                    "created_at": now, "updated_at": now,
                    "language": "en", "group_slug": group_slug, "status": "published",
                },
            )
            stats["imported"] += 1
            logger.info("[IMPORT %d] %s → %s", score, path.name, slug)

            if path.name in translate:
                stats["translated"] += 1
                # Note: actual translation is done in a separate pass (see translate_posts)
                logger.info("[TRANSLATE %d] %s (queued for translation)", score, path.name)

        await session.commit()

    return stats


async def translate_high_scored(posts: list[tuple[Path, dict]], scores: dict[str, int]) -> int:
    """Translate score >= 8 posts to Chinese and insert ZH versions."""
    client = OpenAI(api_key=settings.blog_llm_api_key, base_url=settings.blog_llm_base_url)
    translated = 0

    for path, meta in posts:
        if scores.get(path.name, 0) < TRANSLATE_THRESHOLD:
            continue

        slug = path.stem[:80]
        group_slug = f"migrated-{path.stem[:60]}"

        prompt = f"""Translate and localize this English blog article into Simplified Chinese (简体中文).

IMPORTANT: This is localization, NOT direct translation. Adapt idioms, cultural references, and examples for Chinese readers. Use natural 地道的中文.

Title: {meta["title"]}
Tags: {json.dumps(meta.get("tags", []))}

Full content:
{meta["content"][:4000]}

Return a JSON object:
{{"title": "Chinese title (SEO optimized)", "excerpt": "Chinese meta description (120-160 chars)", "content": "Full Chinese markdown content", "tags": ["tag1", "tag2"], "read_time": "X 分钟"}}

Output ONLY the JSON object."""

        try:
            response = client.chat.completions.create(
                model=settings.blog_llm_model,
                messages=[
                    {"role": "system", "content": "You are a professional translator. Output only valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.6,
                max_tokens=4096,
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content
            zh_data = json.loads(raw or "{}")
            if not zh_data.get("content"):
                logger.warning("Empty translation for %s", path.name)
                continue

            now = datetime.now(timezone.utc)
            zh_slug = f"{slug}-zh"
            async with SessionLocal() as session:
                await session.execute(
                    text(
                        """insert into blog_posts (id, slug, title, excerpt, content, author, read_time, tags, published_at, created_at, updated_at, language, group_slug, status)
                        values (:id, :slug, :title, :excerpt, :content, 'SightWhale', :read_time, :tags, :published_at, :created_at, :updated_at, 'zh', :group_slug, 'published')
                        on conflict (slug, language) do update set
                            title=excluded.title, excerpt=excluded.excerpt, content=excluded.content, tags=excluded.tags, updated_at=excluded.updated_at"""
                    ),
                    {
                        "id": str(uuid.uuid4()), "slug": zh_slug,
                        "title": zh_data["title"], "excerpt": zh_data.get("excerpt", ""),
                        "content": zh_data["content"],
                        "read_time": zh_data.get("read_time", "5 分钟"),
                        "tags": zh_data.get("tags", meta.get("tags", [])),
                        "published_at": datetime.now(timezone.utc),
                        "created_at": now, "updated_at": now, "group_slug": group_slug,
                    },
                )
                await session.commit()
            translated += 1
            logger.info("[ZH DONE] %s", path.name)
        except Exception as e:
            logger.error("Translation failed for %s: %s", path.name, e)

    return translated


async def main():
    logger.info("Discovering posts in %s...", POSTS_DIR)
    paths = list_posts()
    logger.info("Found %d markdown files", len(paths))

    # Parse all
    parsed = [(p, parse_frontmatter(p)) for p in paths]

    # Score (or load cached)
    if SCORES_FILE.exists():
        try:
            scores = json.loads(SCORES_FILE.read_text())
            logger.info("Loaded cached scores from %s (%d posts)", SCORES_FILE, len(scores))
        except Exception:
            scores = {}
    else:
        scores = {}

    missing = [p for p, _ in parsed if p.name not in scores]
    if missing:
        logger.info("Scoring %d uncached posts via DeepSeek...", len(missing))
        new_scores = score_posts([(p, m) for p, m in parsed if p in missing])
        scores.update(new_scores)
    else:
        logger.info("All %d posts have cached scores", len(scores))

    # Stats
    high = sum(1 for s in scores.values() if s >= SCORE_THRESHOLD)
    low = sum(1 for s in scores.values() if s < SCORE_THRESHOLD)
    top = sum(1 for s in scores.values() if s >= TRANSLATE_THRESHOLD)
    logger.info("Score distribution: >=%d: %d, <%d: %d, >=%d (translate): %d",
                SCORE_THRESHOLD, high, SCORE_THRESHOLD, low, TRANSLATE_THRESHOLD, top)

    # Confirm
    print(f"\nWill import {high} posts, reject {low} posts, translate {top} posts.")
    print(f"Rejected posts go to: {REJECTED_DIR}")
    import sys as _sys
    if "--yes" not in _sys.argv:
        confirm = input("Proceed? [y/N]: ").strip().lower()
        if confirm not in ("y", "yes"):
            print("Aborted.")
            return

    # Migrate
    translate_set = {p.name for p, _ in parsed if scores.get(p.name, 0) >= TRANSLATE_THRESHOLD}
    stats = await migrate_posts(parsed, scores, translate_set)
    logger.info("Migration done: imported=%d rejected=%d", stats["imported"], stats["rejected"])

    # Translate high-scored
    if top > 0:
        logger.info("Translating %d high-scored posts to Chinese...", top)
        translated = await translate_high_scored(parsed, scores)
        logger.info("Translated %d posts", translated)

    # Summary
    print(f"\n=== Migration Summary ===")
    print(f"Imported (EN):  {stats['imported']}")
    print(f"Translated (ZH): {translated if top > 0 else 0}")
    print(f"Rejected:       {stats['rejected']}")
    print(f"Rejected dir:   {REJECTED_DIR}")
    print(f"Total processed: {len(paths)}")


if __name__ == "__main__":
    asyncio.run(main())
