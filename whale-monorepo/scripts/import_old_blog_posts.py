#!/usr/bin/env python3
"""
Import quality-filtered old blog posts into the blog_posts database.

Scans content/posts/ for markdown files, filters by 1000+ word count,
pairs EN/ZH versions, and sends them to the trade-ingest API.

Usage:
  python scripts/import_old_blog_posts.py --dry-run       # scan & report only
  python scripts/import_old_blog_posts.py --run            # import all qualifying posts
  python scripts/import_old_blog_posts.py --run --limit 5  # import first 5 only
"""

import argparse
import asyncio
import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import httpx
import yaml

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from shared.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CONTENT_DIR = Path(__file__).parent.parent / "services" / "landing" / "src" / "content" / "posts"
API_BASE = os.environ.get("TRADE_INGEST_API_URL", "https://sightwhale.onrender.com")
ADMIN_KEY = settings.blog_llm_api_key or os.environ.get("BLOG_LLM_API_KEY", "")
MIN_WORDS = 1000
WORDS_PER_MINUTE = 200

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)

# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------


def parse_markdown_file(filepath: Path) -> Optional[dict]:
    """Parse a markdown file with YAML frontmatter. Returns None on failure."""
    try:
        text = filepath.read_text(encoding="utf-8-sig")  # utf-8-sig handles BOM
    except Exception:
        logger.warning("Cannot read %s", filepath.name)
        return None

    m = FRONTMATTER_RE.match(text)
    if m:
        try:
            meta = yaml.safe_load(m.group(1))
        except yaml.YAMLError:
            logger.warning("Bad YAML in %s", filepath.name)
            return None
        content = text[m.end():].strip()
    else:
        # No frontmatter — extract title from first H1, use first paragraph as excerpt
        logger.debug("No frontmatter in %s, extracting from body", filepath.name)
        meta = {}
        content = text.strip()
        # Try to extract title from first # heading
        title_match = re.match(r"^#\s+(.+)$", content, re.MULTILINE)
        if title_match:
            meta["title"] = title_match.group(1).strip()
            content = content[title_match.end():].strip()
        # First non-heading paragraph as excerpt
        para_match = re.search(r"^(?!>|#|\*\*Published)[^\n]{50,}", content, re.MULTILINE)
        if para_match:
            meta["excerpt"] = para_match.group(0).strip()[:160]
    # Determine language from filename (before word count — Chinese uses chars/2)
    filename = filepath.stem  # without .md
    if filename.startswith("zh-"):
        language = "zh"
        slug = filename[3:]  # strip zh- prefix
    else:
        language = "en"
        slug = filename

    # Word count: English uses split(), Chinese uses chars/2
    if language == "zh":
        word_count = len(content.replace(" ", "")) // 2
    else:
        word_count = len(content.split())
    read_time = max(1, word_count // WORDS_PER_MINUTE)

    # Truncate slug if needed (DB column is 256)
    slug = slug[:250]

    return {
        "filename": filepath.name,
        "slug": slug,
        "language": language,
        "title": str(meta.get("title", slug)).strip(),
        "excerpt": str(meta.get("excerpt", "")).strip()[:1024],
        "content": content,
        "author": str(meta.get("author", "SightWhale")).strip(),
        "read_time": f"{read_time} min",
        "tags": _normalize_tags(meta.get("tags", [])),
        "published_at": str(meta.get("date", "")).strip(),
        "word_count": word_count,
    }


def _normalize_tags(tags) -> list[str]:
    """Ensure tags is a list of strings."""
    if isinstance(tags, list):
        return [str(t).strip() for t in tags if str(t).strip()]
    if isinstance(tags, str):
        try:
            return [t.strip() for t in json.loads(tags) if t.strip()]
        except (json.JSONDecodeError, TypeError):
            return [t.strip() for t in tags.split(",") if t.strip()]
    return []


# ---------------------------------------------------------------------------
# Import
# ---------------------------------------------------------------------------


async def import_post(client: httpx.AsyncClient, post: dict, group_slug: Optional[str] = None) -> bool:
    """Send a single post to the trade-ingest API. Returns True on success."""
    payload = {
        "slug": post["slug"],
        "title": post["title"],
        "excerpt": post["excerpt"],
        "content": post["content"],
        "author": post["author"],
        "read_time": post["read_time"],
        "tags": post["tags"],
        "language": post["language"],
        "group_slug": group_slug,
        "status": "published",
    }

    url = f"{API_BASE}/blog/post"
    headers = {
        "Content-Type": "application/json",
        "x-admin-key": ADMIN_KEY,
    }

    try:
        resp = await client.post(url, json=payload, headers=headers, timeout=30)
        if resp.status_code == 200:
            return True
        body = resp.text[:200]
        logger.error("API %s for %s (%s): %s", resp.status_code, post["slug"], post["language"], body)
        return False
    except httpx.RequestError as e:
        logger.error("Request failed for %s: %s", post["slug"], e)
        return False


async def run_import(posts: list[dict], dry_run: bool = False, limit: Optional[int] = None) -> dict:
    """Import posts in batches. Respects ON CONFLICT (slug, language) DO UPDATE."""
    if not ADMIN_KEY:
        logger.error("BLOG_LLM_API_KEY not set — cannot authenticate to API")
        return {"ok": 0, "fail": 0, "skip": 0, "error": "no api key"}

    # Match EN/ZH pairs by slug
    en_posts = [p for p in posts if p["language"] == "en"]
    zh_posts = {p["slug"]: p for p in posts if p["language"] == "zh"}

    # Build import queue: EN first, then ZH (so group_slug is available)
    queue = []
    for p in en_posts:
        has_zh = p["slug"] in zh_posts
        queue.append((p, p["slug"] if has_zh else None))
    for slug, p in zh_posts.items():
        # Only add ZH if EN counterpart also exists (paired)
        en_match = next((ep for ep in en_posts if ep["slug"] == slug), None)
        if en_match:
            queue.append((p, slug))

    if limit:
        queue = queue[:limit]

    logger.info(
        "Import queue: %d posts (%d EN, %d ZH paired, %d ZH orphan) — %s",
        len(queue),
        len([q for q in queue if q[0]["language"] == "en"]),
        len([q for q in queue if q[0]["language"] == "zh"]),
        len(zh_posts) - len([q for q in queue if q[0]["language"] == "zh"]),
        "DRY RUN" if dry_run else "LIVE",
    )

    if dry_run:
        for post, group_slug in queue:
            logger.info(
                "  [DRY] %-6s %4d words  %-50s  group=%s",
                post["language"].upper(),
                post["word_count"],
                post["slug"][:48],
                group_slug or "—",
            )
        return {"ok": len(queue), "fail": 0, "skip": 0}

    ok, fail = 0, 0
    async with httpx.AsyncClient() as client:
        for i, (post, group_slug) in enumerate(queue, 1):
            logger.info(
                "[%d/%d] %s %s (%d words)",
                i, len(queue), post["language"].upper(), post["slug"], post["word_count"],
            )
            if await import_post(client, post, group_slug):
                ok += 1
            else:
                fail += 1
            # Small delay to avoid hammering the API
            if i < len(queue):
                await asyncio.sleep(0.3)

    return {"ok": ok, "fail": fail, "skip": 0}


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(description="Import old blog posts into database")
    parser.add_argument("--dry-run", action="store_true", help="Scan and report, no import")
    parser.add_argument("--run", action="store_true", help="Execute the import")
    parser.add_argument("--limit", type=int, default=None, help="Max posts to import")
    parser.add_argument("--min-words", type=int, default=MIN_WORDS, help=f"Minimum word count (default: {MIN_WORDS})")
    args = parser.parse_args()

    if not args.dry_run and not args.run:
        parser.print_help()
        print("\nExamples:")
        print("  python scripts/import_old_blog_posts.py --dry-run")
        print("  python scripts/import_old_blog_posts.py --run")
        print("  python scripts/import_old_blog_posts.py --run --limit 10")
        return 1

    # Discover and parse
    if not CONTENT_DIR.exists():
        logger.error("Content directory not found: %s", CONTENT_DIR)
        return 1

    md_files = sorted(CONTENT_DIR.glob("*.md"))
    # Exclude _rejected
    md_files = [f for f in md_files if "_rejected" not in str(f.parent / "") and not f.name.startswith("._")]
    logger.info("Found %d markdown files in %s", len(md_files), CONTENT_DIR)

    parsed = []
    for fp in md_files:
        post = parse_markdown_file(fp)
        if post:
            parsed.append(post)

    logger.info("Parsed %d files successfully", len(parsed))

    # Filter by quality
    qualifying = [p for p in parsed if p["word_count"] >= args.min_words]
    rejected = len(parsed) - len(qualifying)

    en_q = len([p for p in qualifying if p["language"] == "en"])
    zh_q = len([p for p in qualifying if p["language"] == "zh"])

    print(f"\n{'='*60}")
    print(f"  Total parsed:  {len(parsed)}")
    print(f"  Qualifying (≥{args.min_words} words):  {len(qualifying)}")
    print(f"    EN: {en_q}  |  ZH: {zh_q}")
    print(f"  Rejected (<{args.min_words} words):     {rejected}")
    print(f"{'='*60}\n")

    if not qualifying:
        logger.info("No qualifying posts to import")
        return 0

    # Run import
    result = asyncio.run(run_import(qualifying, dry_run=args.dry_run, limit=args.limit))

    print(f"\n{'='*60}")
    print(f"  OK:    {result['ok']}")
    print(f"  Fail:  {result['fail']}")
    print(f"  Skip:  {result.get('skip', 0)}")
    if "error" in result:
        print(f"  Error: {result['error']}")
    print(f"{'='*60}")

    return 0 if result["fail"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
