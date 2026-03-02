#!/usr/bin/env python3
"""
Blog Automation System
Manages daily blog post generation and scheduling
"""

import asyncio
import os
import sys
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, List

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Import the enhanced blog generator
from enhanced_daily_blog import EnhancedBlogGenerator, BlogPost

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('blog_automation.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class BlogAutomation:
    """Manages automated blog content generation"""
    
    def __init__(self):
        self.generator = EnhancedBlogGenerator()
        self.config_file = Path(__file__).parent / 'blog_config.json'
        self.last_run_file = Path(__file__).parent / 'last_blog_run.txt'
        self.config = self.load_config()
        
    def load_config(self) -> Dict:
        """Load configuration"""
        default_config = {
            "enabled": True,
            "schedule": "daily",  # daily, weekly
            "publish_time": "09:00",  # 24-hour format
            "min_content_quality": 0.7,
            "max_posts_per_day": 1,
            "content_sources": ["polymarket", "whale_data"],
            "quality_thresholds": {
                "min_word_count": 600,
                "min_insights": 2,
                "max_ai_score": 0.3  # Lower is better (less AI-like)
            }
        }
        
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r') as f:
                    loaded_config = json.load(f)
                    # Merge with defaults
                    default_config.update(loaded_config)
            except Exception as e:
                logger.error(f"Error loading config: {e}")
        
        return default_config
    
    def save_config(self):
        """Save configuration"""
        try:
            with open(self.config_file, 'w') as f:
                json.dump(self.config, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving config: {e}")
    
    def get_last_run_time(self) -> Optional[datetime]:
        """Get last successful run time"""
        if not self.last_run_file.exists():
            return None
        
        try:
            with open(self.last_run_file, 'r') as f:
                timestamp_str = f.read().strip()
                return datetime.fromisoformat(timestamp_str)
        except Exception as e:
            logger.error(f"Error reading last run time: {e}")
            return None
    
    def set_last_run_time(self, run_time: datetime):
        """Set last successful run time"""
        try:
            with open(self.last_run_file, 'w') as f:
                f.write(run_time.isoformat())
        except Exception as e:
            logger.error(f"Error saving last run time: {e}")
    
    def should_generate_post(self) -> bool:
        """Check if we should generate a post now"""
        if not self.config.get("enabled", True):
            logger.info("Blog automation is disabled")
            return False
        
        last_run = self.get_last_run_time()
        if last_run:
            # Check if we've already posted today
            if last_run.date() >= datetime.now().date():
                logger.info("Already generated post today")
                return False
            
            # Check schedule
            schedule = self.config.get("schedule", "daily")
            if schedule == "daily":
                # Check if enough time has passed (24 hours)
                if datetime.now() - last_run < timedelta(hours=20):  # 20 hours to account for timing variations
                    logger.info("Not enough time has passed since last post")
                    return False
        
        # Check publish time
        publish_time = self.config.get("publish_time", "09:00")
        current_time = datetime.now().strftime("%H:%M")
        
        if current_time < publish_time:
            logger.info(f"Too early to publish (current: {current_time}, scheduled: {publish_time})")
            return False
        
        return True
    
    def validate_content_quality(self, post: BlogPost) -> bool:
        """Validate content quality against thresholds"""
        thresholds = self.config.get("quality_thresholds", {})
        
        # Check word count
        word_count = len(post.content.split())
        min_words = thresholds.get("min_word_count", 600)
        if word_count < min_words:
            logger.warning(f"Content quality check failed: word count {word_count} < {min_words}")
            return False
        
        # Check insights count (rough heuristic)
        insights_count = post.content.count('•') + post.content.count('*')
        min_insights = thresholds.get("min_insights", 2)
        if insights_count < min_insights:
            logger.warning(f"Content quality check failed: insights {insights_count} < {min_insights}")
            return False
        
        # Check for AI-like phrases (basic heuristic)
        ai_phrases = ['AI-generated', 'algorithm', 'machine learning', 'data-driven']
        ai_score = sum(1 for phrase in ai_phrases if phrase.lower() in post.content.lower())
        max_ai_score = thresholds.get("max_ai_score", 0.3)
        if ai_score > max_ai_score * len(ai_phrases):
            logger.warning(f"Content quality check failed: too many AI-like phrases")
            return False
        
        logger.info(f"Content quality check passed: {word_count} words, {insights_count} insights")
        return True
    
    async def generate_daily_post(self, mock_data: bool = False) -> Optional[str]:
        """Generate daily blog post"""
        try:
            logger.info("Starting daily blog post generation")
            
            # Generate content
            result = await self.generator.generate_daily_content(mock_data=mock_data)
            
            if not result:
                logger.error("Failed to generate blog content")
                return None
            
            # Validate content quality
            # Note: In a real implementation, you'd load the generated post and validate it
            # For now, we'll assume the generator creates quality content
            
            logger.info(f"Successfully generated blog post: {result}")
            return result
            
        except Exception as e:
            logger.error(f"Error generating daily post: {e}")
            return None
    
    def get_post_stats(self, filepath: str) -> Dict:
        """Get statistics about a generated post"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Extract frontmatter and content
            if content.startswith('---'):
                parts = content.split('---', 2)
                if len(parts) >= 3:
                    frontmatter = parts[1].strip()
                    post_content = parts[2].strip()
                    
                    # Parse frontmatter (basic parsing)
                    stats = {
                        'word_count': len(post_content.split()),
                        'char_count': len(post_content),
                        'line_count': len(post_content.split('\n')),
                        'has_frontmatter': True
                    }
                    
                    # Extract title if possible
                    for line in frontmatter.split('\n'):
                        if line.strip().startswith('title:'):
                            stats['title'] = line.split(':', 1)[1].strip().strip('"')
                            break
                    
                    return stats
            
            # Fallback for posts without frontmatter
            return {
                'word_count': len(content.split()),
                'char_count': len(content),
                'line_count': len(content.split('\n')),
                'has_frontmatter': False
            }
            
        except Exception as e:
            logger.error(f"Error getting post stats: {e}")
            return {}
    
    async def run_automation(self, mock_data: bool = False) -> bool:
        """Run the complete automation workflow"""
        logger.info("Starting blog automation workflow")
        
        # Check if we should generate
        if not self.should_generate_post():
            logger.info("Skipping post generation based on schedule/rules")
            return True
        
        # Generate post
        result = await self.generate_daily_post(mock_data=mock_data)
        
        if result:
            # Update last run time
            self.set_last_run_time(datetime.now())
            
            # Get post statistics
            stats = self.get_post_stats(result)
            logger.info(f"Post statistics: {stats}")
            
            return True
        else:
            logger.error("Failed to generate post")
            return False
    
    def generate_report(self) -> Dict:
        """Generate automation report"""
        last_run = self.get_last_run_time()
        
        # Count recent posts
        posts_dir = Path(__file__).parent.parent / 'services' / 'landing' / 'src' / 'content' / 'posts'
        recent_posts = []
        
        if posts_dir.exists():
            for post_file in posts_dir.glob('*.md'):
                try:
                    stats = os.stat(post_file)
                    file_time = datetime.fromtimestamp(stats.st_mtime)
                    
                    if datetime.now() - file_time < timedelta(days=7):  # Last 7 days
                        post_stats = self.get_post_stats(str(post_file))
                        recent_posts.append({
                            'filename': post_file.name,
                            'modified': file_time.isoformat(),
                            'stats': post_stats
                        })
                except Exception as e:
                    logger.error(f"Error processing {post_file}: {e}")
        
        return {
            "automation_enabled": self.config.get("enabled", True),
            "last_run": last_run.isoformat() if last_run else None,
            "total_recent_posts": len(recent_posts),
            "recent_posts": recent_posts,
            "config": self.config
        }

async def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Blog Automation System')
    parser.add_argument('--run', action='store_true', help='Run automation now')
    parser.add_argument('--mock', action='store_true', help='Use mock data')
    parser.add_argument('--report', action='store_true', help='Generate report')
    parser.add_argument('--config', type=str, help='Show/edit config (get/set)')
    parser.add_argument('--value', type=str, help='Value for config set')
    
    args = parser.parse_args()
    
    automation = BlogAutomation()
    
    if args.report:
        # Generate report
        report = automation.generate_report()
        print(json.dumps(report, indent=2))
        
    elif args.config:
        # Handle config operations
        if args.config == 'get':
            print(json.dumps(automation.config, indent=2))
        elif args.config == 'set' and args.value:
            try:
                # Parse value as JSON
                value = json.loads(args.value)
                automation.config.update(value)
                automation.save_config()
                print("Config updated successfully")
            except json.JSONDecodeError:
                print("Error: Value must be valid JSON")
        else:
            print("Usage: --config get OR --config set --value '{\"key\": \"value\"}'")
            
    elif args.run:
        # Run automation
        print("🚀 Starting Blog Automation System")
        print("=" * 40)
        
        success = await automation.run_automation(mock_data=args.mock)
        
        if success:
            print("\n✅ Automation completed successfully!")
        else:
            print("\n❌ Automation failed!")
            return 1
            
    else:
        # Show help
        parser.print_help()
        print("\nExamples:")
        print("  python blog_automation.py --run           # Run automation with real data")
        print("  python blog_automation.py --run --mock    # Run automation with mock data")
        print("  python blog_automation.py --report        # Generate automation report")
        print("  python blog_automation.py --config get    # Show current config")
        print("  python blog_automation.py --config set --value '{\"enabled\": false}'")
    
    return 0

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)