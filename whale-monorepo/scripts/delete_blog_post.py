"""Delete a blog post by slug + language via the trade-ingest API.

Usage: python scripts/delete_blog_post.py <slug> <language>
Example: python scripts/delete_blog_post.py test en
"""

import sys
import urllib.request
import json
from pathlib import Path

# Add monorepo root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.config import settings

def delete_blog_post(slug: str, language: str = "en"):
    url = f"{settings.health_trade_ingest_api_url}/blog/post?slug={slug}&language={language}"
    req = urllib.request.Request(url, method="DELETE")
    req.add_header("X-Admin-Key", settings.blog_llm_api_key)

    try:
        resp = urllib.request.urlopen(req)
        result = json.loads(resp.read())
        print(f"Status: {resp.status}")
        print(f"Result: {json.dumps(result, indent=2)}")
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code}")
        print(e.read().decode())

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    slug = sys.argv[1]
    lang = sys.argv[2] if len(sys.argv) > 2 else "en"
    delete_blog_post(slug, lang)
