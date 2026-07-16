#!/usr/bin/env python3
"""
Blog Automation System
Manages daily blog post generation via LLM + on-chain data pipeline.

Called by GitHub Actions (daily-blog.yml) every day at 9:00 AM UTC.
Results are inserted directly into the blog_posts database table —
the landing app reads them via the trade-ingest API.
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from services.trade_ingest.blog_generator import generate_daily_article

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler("blog_automation.log"), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)


class BlogAutomation:
    """Orchestrates the daily blog generation pipeline."""

    def __init__(self) -> None:
        self.config_file = Path(__file__).parent / "blog_config.json"
        self.last_run_file = Path(__file__).parent / "last_blog_run.txt"
        self.config = self._load_config()

    # ------------------------------------------------------------------
    # Config
    # ------------------------------------------------------------------

    def _load_config(self) -> dict:
        default_config = {
            "enabled": True,
            "schedule": "daily",
            "publish_time": "09:00",
            "max_posts_per_day": 1,
        }
        if self.config_file.exists():
            try:
                with open(self.config_file, "r") as f:
                    default_config.update(json.load(f))
            except Exception:
                logger.exception("Error loading blog_config.json, using defaults")
        return default_config

    # ------------------------------------------------------------------
    # Scheduling
    # ------------------------------------------------------------------

    def _get_last_run_time(self) -> Optional[datetime]:
        if not self.last_run_file.exists():
            return None
        try:
            return datetime.fromisoformat(self.last_run_file.read_text().strip())
        except Exception:
            logger.exception("Error reading last_blog_run.txt")
            return None

    def _set_last_run_time(self, run_time: datetime) -> None:
        self.last_run_file.write_text(run_time.isoformat())

    def should_generate_post(self) -> bool:
        """Decide whether to generate a post right now."""
        if not self.config.get("enabled", True):
            logger.info("Blog automation is disabled in config")
            return False

        now = datetime.now()
        last_run = self._get_last_run_time()

        if last_run:
            if last_run.date() >= now.date():
                logger.info("Already generated a post today")
                return False

            schedule = self.config.get("schedule", "daily")
            if schedule == "daily" and now - last_run < timedelta(hours=20):
                logger.info("Less than 20h since last post, skipping")
                return False

        publish_time = self.config.get("publish_time", "09:00")
        if now.strftime("%H:%M") < publish_time:
            logger.info(
                "Too early (current=%s, scheduled=%s)", now.strftime("%H:%M"), publish_time
            )
            return False

        return True

    # ------------------------------------------------------------------
    # Core
    # ------------------------------------------------------------------

    async def run(self) -> bool:
        """Run the complete automation workflow.

        Calls the LLM-powered blog_generator which:
        1. Fetches real on-chain whale trade data from Postgres
        2. Generates EN + ZH articles via DeepSeek
        3. Inserts both into the blog_posts table
        """
        logger.info("=== Starting blog automation ===")

        if not self.should_generate_post():
            logger.info("Skipping — schedule check failed")
            return True  # not an error, just nothing to do

        try:
            result = await generate_daily_article()
        except Exception:
            logger.exception("generate_daily_article() raised")
            return False

        status = result.get("status", "unknown")
        if status == "disabled":
            logger.info("Blog generation is disabled (BLOG_DAILY_ENABLED=false)")
            return True

        if status == "failed":
            logger.error("Blog generation failed: %s", result.get("reason", "unknown"))
            return False

        if status == "published":
            self._set_last_run_time(datetime.now())
            logger.info(
                "✅ Published! group=%s languages=%s en=%s zh=%s",
                result.get("group_slug"),
                result.get("languages"),
                result.get("en_title", "—"),
                result.get("zh_title", "—"),
            )
            return True

        logger.warning("Unexpected status: %s", status)
        return False


# ------------------------------------------------------------------
# CLI
# ------------------------------------------------------------------


async def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Blog Automation System")
    parser.add_argument("--run", action="store_true", help="Run automation now")
    parser.add_argument("--report", action="store_true", help="Show last-run info")
    args = parser.parse_args()

    automation = BlogAutomation()

    if args.report:
        last = automation._get_last_run_time()
        print(json.dumps({
            "enabled": automation.config.get("enabled"),
            "last_run": last.isoformat() if last else None,
            "config": automation.config,
        }, indent=2))
        return 0

    if args.run:
        print("🚀 Blog Automation — LLM + On-Chain Pipeline")
        print("=" * 44)
        ok = await automation.run()
        print("\n✅ Success!" if ok else "\n❌ Failed!")
        return 0 if ok else 1

    parser.print_help()
    print("\nExamples:")
    print("  python blog_automation.py --run      # Generate & publish today's article")
    print("  python blog_automation.py --report   # Show last-run status")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
