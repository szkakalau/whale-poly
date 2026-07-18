"""Insert the Polymarket Arbitrage Guide (EN + ZH) into blog_posts via API.

Usage:
    cd whale-poly/whale-monorepo
    python scripts/insert_arbitrage_guide.py
"""

from __future__ import annotations

import json
import logging
import sys
import urllib.request
import urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shared.config import settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("insert_arbitrage_guide")

POSTS_DIR = Path("services/landing/src/content/posts")

EN_FILE = POSTS_DIR / "polymarket-arbitrage-2026-complete-guide.md"
ZH_FILE = POSTS_DIR / "zh-polymarket-arbitrage-2026-complete-guide.md"

API_BASE = settings.health_trade_ingest_api_url
API_KEY = settings.blog_llm_api_key


def parse_frontmatter(path: Path) -> dict:
    """Parse YAML frontmatter from a markdown file."""
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


def post_blog_post(meta: dict, slug: str, language: str) -> dict:
    """Insert or update a blog post via the trade-ingest API."""
    payload = {
        "slug": slug,
        "title": meta["title"],
        "excerpt": meta.get("excerpt", ""),
        "content": meta["content"],
        "author": meta.get("author", "SightWhale"),
        "read_time": meta.get("readTime", "8 min"),
        "tags": meta.get("tags", []),
        "language": language,
        "group_slug": "polymarket-arbitrage-2026",
        "status": "published",
    }

    url = f"{API_BASE}/blog/post"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("X-Admin-Key", API_KEY)

    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}", "body": e.read().decode()}


def main():
    if not API_KEY:
        logger.error("BLOG_LLM_API_KEY is not set. Check your .env file.")
        sys.exit(1)

    logger.info("Parsing EN post: %s", EN_FILE)
    en_meta = parse_frontmatter(EN_FILE)
    logger.info("Parsing ZH post: %s", ZH_FILE)
    zh_meta = parse_frontmatter(ZH_FILE)

    en_slug = "polymarket-arbitrage-2026-complete-guide"
    zh_slug = "zh-polymarket-arbitrage-2026-complete-guide"

    logger.info("Inserting EN post via API...")
    en_result = post_blog_post(en_meta, en_slug, "en")
    logger.info("EN result: %s", json.dumps(en_result, ensure_ascii=False))

    logger.info("Inserting ZH post via API...")
    zh_result = post_blog_post(zh_meta, zh_slug, "zh")
    logger.info("ZH result: %s", json.dumps(zh_result, ensure_ascii=False))

    print("\n=== Insert Summary ===")
    print(f"EN: {en_meta['title']}")
    print(f"ZH: {zh_meta['title']}")
    print(f"EN URL: https://www.sightwhale.com/blog/en/{en_slug}")
    print(f"ZH URL: https://www.sightwhale.com/blog/zh/{zh_slug}")


if __name__ == "__main__":
    main()
