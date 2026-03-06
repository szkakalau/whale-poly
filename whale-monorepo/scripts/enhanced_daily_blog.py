#!/usr/bin/env python3
"""
Enhanced Daily Blog Content Generator
Creates engaging, human-like blog posts about prediction markets and whale activity
"""

import asyncio
import os
import sys
import json
import random
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from pathlib import Path

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

try:
    from shared.models.models import Base, TradeRaw, WhaleStats, Market, WalletName, WhaleProfile
except ImportError:
    print("Error: Could not import shared models.")
    sys.exit(1)

@dataclass
class MarketAnalysis:
    """Market data with analysis"""
    market_title: str
    market_id: str
    current_probability: float
    volume_24h: float
    whale_score: float
    recent_trades: List[Dict]
    top_holders: List[Dict]
    market_sentiment: str
    key_insights: List[str]

@dataclass
class BlogPost:
    """Complete blog post data"""
    title: str
    excerpt: str
    content: str
    tags: List[str]
    read_time: str
    author: str
    date: str
    slug: str

class EnhancedBlogGenerator:
    """Generates engaging, human-like blog content"""
    
    def __init__(self):
        self.content_dir = Path(__file__).parent.parent / 'services' / 'landing' / 'src' / 'content' / 'posts'
        self.content_dir.mkdir(parents=True, exist_ok=True)
        
        # 内容生成配置
        self.config = {
            'min_word_count': 800,
            'max_word_count': 1500,
            'tone': 'analytical_but_conversational',
            'avoid_phrases': ['AI-generated', 'algorithm', 'machine learning', 'data-driven'],
            'preferred_phrases': ['market intelligence', 'smart money signals', 'whale watching', 'capital flows']
        }
        
        # 引人入胜的开头模板
        self.intro_templates = [
            "While most traders were focused on the headlines, something interesting was happening in the order books...",
            "The numbers don't lie, but they don't always tell the whole story either. Here's what actually happened...",
            "Another day, another market move. But beneath the surface, the real story is unfolding...",
            "Markets move fast, but capital leaves footprints. Let's follow where the smart money went...",
            "Everyone has an opinion. Only a few have the capital to back it up. Here's what they're betting on..."
        ]
        
        # 市场分析模板
        self.analysis_templates = {
            'bullish': [
                "With {probability}% odds, the market is showing strong confidence. But confidence can be fragile...",
                "At {probability}%, this isn't just consensus - it's conviction. The question is whether that conviction is justified...",
                "The market has spoken, and it's clearly bullish. But markets also get things wrong, spectacularly..."
            ],
            'bearish': [
                "At just {probability}%, this is either a contrarian opportunity or a value trap...",
                "The market says it's unlikely. History says unlikely things happen all the time...",
                "Low probability doesn't mean no probability. Here's why the bears might be undervalued..."
            ],
            'neutral': [
                "The market is genuinely torn. Neither side has a clear edge, and that's creating opportunity...",
                "This isn't consensus - it's confusion. And confusion creates the best trading opportunities...",
                "The split decision tells us more than any single probability could..."
            ]
        }
        
        # 鲸鱼信号模板
        self.whale_templates = {
            'large_buy': [
                "When six-figure buys hit the order book, people notice. But size isn't everything - timing matters more...",
                "Big money moves markets, but smart money moves first. This trade has both...",
                "It's not just the amount that caught our eye. It's the conviction behind it..."
            ],
            'contrarian': [
                "While everyone else was selling, someone was buying. That someone usually knows something...",
                "The crowd moves together. Smart money moves alone. This trade is definitely alone...",
                "Contrarian trades are either genius or suicide. The difference is usually information..."
            ],
            'consistent_winner': [
                "This isn't their first rodeo. The wallet history shows a pattern that's hard to ignore...",
                "Some traders get lucky. Others get lucky consistently. We're looking at the latter...",
                "Past performance doesn't guarantee future results, but it does suggest skill..."
            ]
        }
        
        # 结论模板
        self.conclusion_templates = [
            "The market will do what the market will do. But now you know what the smart money is thinking...",
            "Prices change, but capital flows leave lasting impressions. Watch where the money goes...",
            "In markets, being right is less important than being early. The whales got early...",
            "Everyone gets the market they deserve. Make sure you're getting the market you earned...",
            "The story isn't over. In fact, it's just beginning. Stay tuned..."
        ]
    
    def select_random(self, items: List[str]) -> str:
        """Select random item from list"""
        return random.choice(items)
    
    def get_market_sentiment(self, probability: float) -> str:
        """Determine market sentiment based on probability"""
        if probability > 0.7:
            return 'bullish'
        elif probability < 0.3:
            return 'bearish'
        else:
            return 'neutral'
    
    def analyze_market_data(self, market_data: Dict) -> MarketAnalysis:
        """Analyze market data and extract insights"""
        probability = market_data.get('probability', 0.5)
        volume = market_data.get('volume_24h', 0)
        whale_score = market_data.get('whale_score', 0.5)
        recent_trades = market_data.get('recent_trades', [])
        
        # 生成关键洞察
        insights = []
        
        if volume > 100000:
            insights.append(f"High volume activity (${volume:,.0f}) suggests institutional interest")
        
        if len(recent_trades) > 5:
            avg_trade_size = sum(t['amount'] for t in recent_trades) / len(recent_trades)
            if avg_trade_size > 10000:
                insights.append(f"Average trade size of ${avg_trade_size:,.0f} indicates serious conviction")
        
        large_trades = [t for t in recent_trades if t['amount'] > 50000]
        if large_trades:
            insights.append(f"{len(large_trades)} whale trades over $50k detected in last 24h")
        
        if whale_score > 0.7:
            insights.append("High whale score (70%+) suggests smart money confidence")
        elif whale_score < 0.3:
            insights.append("Low whale score indicates retail-dominated activity")
        
        return MarketAnalysis(
            market_title=market_data.get('title', 'Market Analysis'),
            market_id=market_data.get('id', ''),
            current_probability=probability,
            volume_24h=volume,
            whale_score=whale_score,
            recent_trades=recent_trades,
            top_holders=market_data.get('top_holders', []),
            market_sentiment=self.get_market_sentiment(probability),
            key_insights=insights
        )
    
    def generate_intro(self, analysis: MarketAnalysis) -> str:
        """Generate engaging introduction"""
        intro = self.select_random(self.intro_templates)
        
        # 添加具体的市场背景
        market_event = analysis.market_title.split(':')[0] if ':' in analysis.market_title else analysis.market_title
        intro = intro.replace('the headlines', f'"{market_event}"')
        
        # 添加引人入胜的统计数据
        intro += f"\n\n{analysis.market_title} has been making waves in the prediction market community, with {analysis.current_probability:.1%} odds reflecting the current consensus."
        
        if analysis.volume_24h > 100000:
            intro += f" Over ${analysis.volume_24h/1000:.0f}k in volume has flowed through this market in recent weeks, suggesting this isn't just casual speculation."
        
        return intro
    
    def generate_market_analysis(self, analysis: MarketAnalysis) -> str:
        """Generate detailed market analysis"""
        templates = self.analysis_templates[analysis.market_sentiment]
        analysis_text = self.select_random(templates)
        
        # 替换模板变量
        analysis_text = analysis_text.format(
            probability=f"{analysis.current_probability:.1%}"
        )
        
        # 添加具体的市场动态分析
        analysis_text += f"\n\nThe order book tells an interesting story. With {analysis.current_probability:.1%} implied probability, we're seeing {analysis.market_sentiment} sentiment dominate the conversation."
        
        # 添加交易量分析
        if analysis.volume_24h > 50000:
            analysis_text += f" The volume patterns suggest this isn't just retail speculation. When six-figure positions start moving, institutional capital is usually involved."
        
        # 添加关键洞察
        if analysis.key_insights:
            analysis_text += f"\n\nKey observations from today's activity:"
            for insight in analysis.key_insights[:3]:  # 最多3个洞察
                analysis_text += f"\n• {insight}"
        
        return analysis_text
    
    def generate_whale_signals(self, analysis: MarketAnalysis) -> str:
        """Generate whale signal analysis"""
        # 确定鲸鱼类型
        if len(analysis.recent_trades) > 5:
            whale_type = 'large_buy'
        elif analysis.current_probability < 0.3 and analysis.whale_score > 0.7:
            whale_type = 'contrarian'
        elif analysis.whale_score > 0.7:
            whale_type = 'consistent_winner'
        else:
            whale_type = 'consistent_winner'  # 默认类型
        
        whale_section = self.select_random(self.whale_templates[whale_type])
        
        # 添加具体的交易分析
        if analysis.recent_trades:
            significant_trades = [t for t in analysis.recent_trades 
                                if t['amount'] > 10000 or t.get('whale_score', 0) > 0.7]
            
            if significant_trades:
                whale_section += f"\n\nIn the past 24 hours, we've identified {len(significant_trades)} significant whale movements:"
                
                for i, trade in enumerate(significant_trades[:3], 1):  # 最多3个交易
                    wallet_name = trade['wallet'][:6] + '...' + trade['wallet'][-4:]
                    conviction = "high-conviction" if trade.get('whale_score', 0) > 0.8 else "notable"
                    
                    whale_section += f"\n\n**{i}. The {conviction} {trade['side']}**\n"
                    whale_section += f"Wallet {wallet_name} just {trade['side']} ${trade['amount']/1000:.1f}k worth of shares. "
                    
                    if trade.get('whale_score', 0) > 0.7:
                        whale_section += f"This wallet has a {trade['whale_score']*100:.0f}% whale score, suggesting they know what they're doing."
                    
                    # 添加交易逻辑分析
                    if trade['side'] == 'buy' and analysis.current_probability < 0.3:
                        whale_section += " Buying into low odds shows real contrarian conviction."
                    elif trade['side'] == 'sell' and analysis.current_probability > 0.7:
                        whale_section += " Selling into high odds suggests they see something others don't."
        
        # 添加持仓分析
        if analysis.top_holders:
            top_holder = analysis.top_holders[0]
            if top_holder.get('position', 0) > 100000:
                whale_section += f"\n\nThe largest position holder controls ${top_holder['position']/1000:.0f}k worth of shares. "
                if top_holder.get('pnl', 0) > 0:
                    whale_section += f"They're currently up ${top_holder['pnl']/1000:.0f}k, which explains their confidence."
                else:
                    whale_section += f"Despite being down ${abs(top_holder.get('pnl', 0))/1000:.0f}k, they're holding firm. That's conviction."
        
        return whale_section
    
    def generate_conclusion(self, analysis: MarketAnalysis) -> str:
        """Generate conclusion with actionable insights"""
        conclusion = self.select_random(self.conclusion_templates)
        
        # 添加具体的行动建议
        if analysis.current_probability > 0.7 and analysis.whale_score > 0.7:
            conclusion += f"\n\nWith strong market consensus ({analysis.current_probability:.1%}) and whale backing, the path of least resistance appears clear. But remember - when everyone agrees, everyone can be wrong."
        elif analysis.current_probability < 0.3 and analysis.whale_score > 0.7:
            conclusion += f"\n\nThe market says it's unlikely ({analysis.current_probability:.1%}), but the whales are positioning for it anyway. Sometimes the best trades are the ones that make you uncomfortable."
        else:
            conclusion += f"\n\nThe mixed signals suggest this market is still finding its direction at {analysis.current_probability:.1%}. Sometimes the best trade is no trade at all - until the picture becomes clearer."
        
        # 添加风险提醒
        conclusion += f"\n\n*This analysis is for informational purposes only. Prediction markets carry significant risk. Never invest more than you can afford to lose.*"
        
        return conclusion
    
    def generate_title(self, analysis: MarketAnalysis) -> str:
        """Generate engaging title"""
        probability = f"{analysis.current_probability:.0%}"
        event_name = analysis.market_title.split(':')[0] if ':' in analysis.market_title else analysis.market_title
        
        title_templates = [
            f"{event_name}: {probability} Odds and What Smart Money Is Really Thinking",
            f"{event_name}: Why the Market Is Pricing {probability} Probability",
            f"{event_name}: Capital Flows, Whale Signals, and Market Intelligence",
            f"{event_name}: Separating Signal From Noise in Prediction Markets",
            f"{event_name}: What {probability} Odds Actually Mean for Traders"
        ]
        
        return self.select_random(title_templates)
    
    def generate_excerpt(self, analysis: MarketAnalysis) -> str:
        """Generate compelling excerpt"""
        probability = f"{analysis.current_probability:.1%}"
        volume_text = f"with over ${analysis.volume_24h/1000:.0f}k in volume" if analysis.volume_24h > 100000 else "gaining significant attention"
        
        excerpt_templates = [
            f"A deep dive into the Polymarket odds for {analysis.market_title}, {volume_text}, and what whale positioning reveals about market expectations.",
            f"Market intelligence on {analysis.market_title}, currently trading at {probability} odds, with analysis of smart money flows and capital allocation patterns.",
            f"Understanding the {probability} probability priced into {analysis.market_title}, including whale signals, volume analysis, and prediction market dynamics."
        ]
        
        return self.select_random(excerpt_templates)
    
    def generate_tags(self, analysis: MarketAnalysis) -> List[str]:
        """Generate relevant tags"""
        base_tags = ['Market Analysis', 'Whale Intelligence', 'Polymarket']
        
        # 根据市场内容添加特定标签
        title_lower = analysis.market_title.lower()
        if any(word in title_lower for word in ['election', 'trump', 'biden', 'president']):
            base_tags.extend(['Politics', 'Election Markets'])
        if any(word in title_lower for word in ['bitcoin', 'crypto', 'solana', 'ethereum']):
            base_tags.extend(['Crypto', 'Digital Assets'])
        if any(word in title_lower for word in ['sports', 'super bowl', 'world cup', 'nba', 'nfl']):
            base_tags.extend(['Sports', 'Sports Betting'])
        if analysis.current_probability < 0.3:
            base_tags.append('Contrarian Bets')
        if analysis.whale_score > 0.7:
            base_tags.append('Smart Money')
        
        return list(set(base_tags))  # 去重
    
    def calculate_read_time(self, content: str) -> str:
        """Calculate estimated read time"""
        words = len(content.split())
        minutes = max(3, (words // 200) + 1)  # 至少3分钟
        return f"{minutes} min"
    
    def generate_blog_post(self, market_data: Dict) -> BlogPost:
        """Generate complete blog post"""
        analysis = self.analyze_market_data(market_data)
        
        # 生成各部分内容
        intro = self.generate_intro(analysis)
        market_analysis = self.generate_market_analysis(analysis)
        whale_signals = self.generate_whale_signals(analysis)
        conclusion = self.generate_conclusion(analysis)
        
        # 组合完整内容
        content = f"{intro}\n\n{market_analysis}\n\n{whale_signals}\n\n{conclusion}"
        
        # 生成元数据
        title = self.generate_title(analysis)
        excerpt = self.generate_excerpt(analysis)
        tags = self.generate_tags(analysis)
        read_time = self.calculate_read_time(content)
        
        # 生成filename
        filename = self.generate_filename(title)
        
        return BlogPost(
            title=title,
            excerpt=excerpt,
            content=content,
            tags=tags,
            read_time=read_time,
            author="Whale Team",
            date=datetime.now().strftime('%Y-%m-%d'),
            slug=slug
        )
    
    def save_blog_post(self, post: BlogPost) -> str:
        """Save blog post to file"""
        filename = self.generate_filename(post.title)
        filepath = self.content_dir / filename
        
        # 生成frontmatter
        frontmatter = f"""---
title: "{post.title}"
excerpt: "{post.excerpt}"
date: "{post.date}"
author: "{post.author}"
readTime: "{post.read_time}"
tags: {json.dumps(post.tags)}
---

"""
        
        # 生成完整内容
        full_content = frontmatter + post.content
        
        # 保存文件
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(full_content)
        
        return str(filepath)
    
    async def generate_daily_content(self, mock_data: bool = False) -> Optional[str]:
        """Generate daily blog content"""
        try:
            if mock_data:
                # 使用模拟数据
                market_data = {
                    'title': 'Will Bitcoin Hit $100K by March 2026?',
                    'id': 'bitcoin-100k-march',
                    'probability': 0.35,
                    'volume_24h': 250000,
                    'whale_score': 0.75,
                    'recent_trades': [
                        {'wallet': '0x1234...abcd', 'amount': 50000, 'side': 'buy', 'whale_score': 0.85},
                        {'wallet': '0x5678...efgh', 'amount': 75000, 'side': 'sell', 'whale_score': 0.72},
                        {'wallet': '0x9abc...def0', 'amount': 25000, 'side': 'buy', 'whale_score': 0.68}
                    ],
                    'top_holders': [
                        {'wallet': '0x1234...abcd', 'position': 150000, 'pnl': 25000},
                        {'wallet': '0x5678...efgh', 'position': 100000, 'pnl': -15000}
                    ]
                }
            else:
                # 这里应该连接真实数据源
                # 暂时使用模拟数据
                market_data = {
                    'title': 'Will Solana Dip Below $150 in February 2026?',
                    'id': 'solana-dip-feb',
                    'probability': 0.28,
                    'volume_24h': 180000,
                    'whale_score': 0.68,
                    'recent_trades': [
                        {'wallet': '0x7429...a1b2', 'amount': 85000, 'side': 'buy', 'whale_score': 0.82},
                        {'wallet': '0x3f8e...c3d4', 'amount': 45000, 'side': 'buy', 'whale_score': 0.75},
                        {'wallet': '0x9k2l...m5n6', 'amount': 65000, 'side': 'sell', 'whale_score': 0.71}
                    ],
                    'top_holders': [
                        {'wallet': '0x7429...a1b2', 'position': 200000, 'pnl': 45000},
                        {'wallet': '0x3f8e...c3d4', 'position': 125000, 'pnl': -8000}
                    ]
                }
            
            # 生成博客文章
            blog_post = self.generate_blog_post(market_data)
            
            # 保存到文件
            filepath = self.save_blog_post(blog_post)
            
            print(f"✅ Generated blog post: {blog_post.title}")
            print(f"📁 Saved to: {filepath}")
            print(f"📊 Market: {market_data['title']}")
            print(f"🎯 Probability: {market_data['probability']:.1%}")
            print(f"🐋 Whale Score: {market_data['whale_score']:.1%}")
            print(f"💰 Volume: ${market_data['volume_24h']:,.0f}")
            print(f"📝 Word Count: {len(blog_post.content.split())}")
            print(f"⏱️  Read Time: {blog_post.read_time}")
            
            return filepath
            
        except Exception as e:
            print(f"Error generating blog content: {e}")
            return None

async def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate enhanced daily blog content')
    parser.add_argument('--mock', action='store_true', help='Use mock data for testing')
    parser.add_argument('--market', type=str, help='Specific market ID to analyze')
    parser.add_argument('--date', type=str, help='Specific date (YYYY-MM-DD)')
    
    args = parser.parse_args()
    
    print("🚀 Enhanced Daily Blog Generator")
    print("=" * 40)
    
    generator = EnhancedBlogGenerator()
    
    # 生成内容
    result = await generator.generate_daily_content(mock_data=args.mock)
    
    if result:
        print(f"\n✨ Blog post generated successfully!")
        print(f"📄 Preview the first 500 characters:")
        
        # 显示预览
        with open(result, 'r') as f:
            content = f.read()
            print(content[:500] + "..." if len(content) > 500 else content)
    else:
        print("\n❌ Failed to generate blog content")
        return 1
    
    return 0

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)