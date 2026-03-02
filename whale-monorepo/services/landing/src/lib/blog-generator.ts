interface BlogPostData {
  title: string;
  excerpt: string;
  content: string;
  tags: string[];
  readTime: string;
  author: string;
}

interface MarketData {
  title: string;
  probability: number;
  volume: number;
  whaleScore: number;
  recentTrades: Array<{
    wallet: string;
    amount: number;
    side: 'buy' | 'sell';
    timestamp: Date;
    whaleScore: number;
  }>;
  topHolders: Array<{
    wallet: string;
    position: number;
    pnl: number;
  }>;
}

type TemplateSelection = {
  analysisType: keyof typeof ANALYSIS_TEMPLATES;
  whaleType: keyof typeof WHALE_TEMPLATES;
  intro: string;
  analysis: string;
  whale: string;
  conclusion: string;
};

// 引人入胜的开头模板
const INTRO_TEMPLATES = [
  "While most traders were focused on [MARKET_EVENT], a different story was unfolding in the order books...",
  "The numbers don't lie, but they don't always tell the whole story either. Here's what the smart money is actually doing...",
  "Another day, another headline. But beneath the surface, something interesting is happening...",
  "Markets move fast, but capital leaves footprints. Let's follow the trail...",
  "Everyone has an opinion. Only a few have the capital to back it up. Here's what they're betting on..."
];

// 市场分析模板
const ANALYSIS_TEMPLATES = {
  highProbability: [
    "With [PROBABILITY]% odds, the market is signaling strong confidence. But confidence can be fragile...",
    "At [PROBABILITY]%, this isn't just consensus - it's conviction. The question is whether that conviction is justified...",
    "The market has spoken, and it's [BULLISH/BEARISH]. But markets also get things wrong, spectacularly..."
  ],
  lowProbability: [
    "At just [PROBABILITY]%, this is either a contrarian goldmine or a fool's errand...",
    "The market says it's unlikely. History says unlikely things happen all the time...",
    "Low probability doesn't mean no probability. Here's why the [BULLS/BEARS] might be undervalued..."
  ],
  balanced: [
    "The market is genuinely torn. Neither side has a clear edge, and that's creating opportunity...",
    "This isn't consensus - it's confusion. And confusion creates the best trading opportunities...",
    "The split decision tells us more than any single probability could..."
  ]
};

// 鲸鱼信号分析模板
const WHALE_TEMPLATES = {
  largeBuy: [
    "When six-figure buys hit the order book, people notice. But size isn't everything - timing matters more...",
    "Big money moves markets, but smart money moves first. This trade has both...",
    "It's not just the amount that caught our eye. It's the conviction behind it..."
  ],
  contrarian: [
    "While everyone else was selling, someone was buying. That someone usually knows something...",
    "The crowd moves together. Smart money moves alone. This trade is definitely alone...",
    "Contrarian trades are either genius or suicide. The difference is usually information..."
  ],
  consistent: [
    "This isn't their first rodeo. The wallet history shows a pattern that's hard to ignore...",
    "Past performance doesn't guarantee future results, but it does suggest skill...",
    "Some traders get lucky. Others get lucky consistently. We're looking at the latter..."
  ]
};

// 结论模板
const CONCLUSION_TEMPLATES = [
  "The market will do what the market will do. But now you know what the smart money is thinking...",
  "Prices change, but capital flows leave lasting impressions. Watch where the money goes, not where the headlines point...",
  "In markets, being right is less important than being early. The whales got early. The question is whether you should follow...",
  "Everyone gets the market they deserve. Make sure you're getting the market you earned...",
  "The story isn't over. In fact, it's just beginning. Stay tuned..."
];

export class BlogContentGenerator {
  
  /**
   * 生成高质量的博客文章内容
   */
  async generateBlogPost(marketData: MarketData, date: Date = new Date()): Promise<BlogPostData> {
    const template = this.selectTemplate(marketData);
    const content = await this.buildContent(marketData, template, date);
    
    return {
      title: this.generateTitle(marketData),
      excerpt: this.generateExcerpt(marketData),
      content: content,
      tags: this.generateTags(marketData),
      readTime: this.calculateReadTime(content),
      author: "Whale Team"
    };
  }

  /**
   * 根据市场数据选择合适的模板
   */
  private selectTemplate(marketData: MarketData): TemplateSelection {
    const probability = marketData.probability;
    const whaleScore = marketData.whaleScore;
    const recentActivity = marketData.recentTrades.length;
    
    let analysisType: keyof typeof ANALYSIS_TEMPLATES = 'balanced';
    if (probability > 0.7) analysisType = 'highProbability';
    else if (probability < 0.3) analysisType = 'lowProbability';
    
    let whaleType: keyof typeof WHALE_TEMPLATES = 'consistent';
    if (recentActivity > 5) whaleType = 'largeBuy';
    else if (probability < 0.3 && whaleScore > 0.7) whaleType = 'contrarian';
    
    return {
      analysisType,
      whaleType,
      intro: this.selectRandom(INTRO_TEMPLATES),
      analysis: this.selectRandom(ANALYSIS_TEMPLATES[analysisType]),
      whale: this.selectRandom(WHALE_TEMPLATES[whaleType]),
      conclusion: this.selectRandom(CONCLUSION_TEMPLATES)
    };
  }

  /**
   * 构建完整的文章内容
   */
  private async buildContent(marketData: MarketData, template: TemplateSelection, date: Date): Promise<string> {
    const sections = [
      this.buildIntro(marketData, template.intro, date),
      this.buildMarketAnalysis(marketData, template.analysis),
      this.buildWhaleSignals(marketData, template.whale),
      this.buildConclusion(marketData, template.conclusion)
    ];
    
    return sections.join('\n\n');
  }

  /**
   * 构建引人入胜的开头
   */
  private buildIntro(marketData: MarketData, introTemplate: string, date: Date): string {
    const marketEvent = this.getMarketEvent(marketData);
    const formattedDate = date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    let intro = introTemplate
      .replace('[MARKET_EVENT]', marketEvent)
      .replace('[DATE]', formattedDate);
    
    // 添加具体的市场背景
    intro += `\n\n${marketData.title} has been making waves in the prediction market community, with ${(marketData.probability * 100).toFixed(1)}% odds reflecting the current consensus. But as any experienced trader knows, consensus and reality don't always align.`;
    
    // 添加引人入胜的统计数据
    if (marketData.volume > 100000) {
      intro += ` Over $${(marketData.volume / 1000).toFixed(0)}k in volume has flowed through this market in recent weeks, suggesting this isn't just casual speculation.`;
    }
    
    return intro;
  }

  /**
   * 构建市场分析部分
   */
  private buildMarketAnalysis(marketData: MarketData, analysisTemplate: string): string {
    const probability = (marketData.probability * 100).toFixed(1);
    const bullish = marketData.probability > 0.5 ? 'bullish' : 'bearish';
    
    let analysis = analysisTemplate
      .replace('[PROBABILITY]', probability)
      .replace('[BULLISH/BEARISH]', bullish.toUpperCase());
    
    // 添加具体的市场动态分析
    analysis += `\n\nThe order book tells an interesting story. With ${probability}% implied probability, we're seeing ${this.getMarketSentiment(marketData.probability)} sentiment dominate the conversation. But the real question isn't what people think - it's what they're willing to bet on.`;
    
    // 添加交易量分析
    if (marketData.volume > 50000) {
      analysis += ` The volume patterns suggest this isn't just retail speculation. When six-figure positions start moving, institutional capital is usually involved.`;
    }
    
    // 添加价格行为分析
    if (marketData.recentTrades.length > 0) {
      const avgTradeSize = marketData.recentTrades.reduce((sum, trade) => sum + trade.amount, 0) / marketData.recentTrades.length;
      if (avgTradeSize > 10000) {
        analysis += ` Average trade sizes of $${(avgTradeSize / 1000).toFixed(0)}k indicate serious conviction behind recent moves.`;
      }
    }
    
    return analysis;
  }

  /**
   * 构建鲸鱼信号分析
   */
  private buildWhaleSignals(marketData: MarketData, whaleTemplate: string): string {
    let whaleSection = whaleTemplate;
    
    if (marketData.recentTrades.length > 0) {
      const significantTrades = marketData.recentTrades
        .filter(trade => trade.amount > 10000 || trade.whaleScore > 0.7)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);
      
      if (significantTrades.length > 0) {
        whaleSection += `\n\nIn the past 24 hours, we've identified ${significantTrades.length} significant whale movements:`;
        
        significantTrades.forEach((trade, index) => {
          const walletName = trade.wallet.substring(0, 6) + '...' + trade.wallet.slice(-4);
          const conviction = trade.whaleScore > 0.8 ? 'high-conviction' : 'notable';
          
          whaleSection += `\n\n**${index + 1}. The ${conviction} ${trade.side}**\n`;
          whaleSection += `Wallet ${walletName} just ${trade.side} $${(trade.amount / 1000).toFixed(1)}k worth of shares. `;
          
          if (trade.whaleScore > 0.7) {
            whaleSection += `This wallet has a ${(trade.whaleScore * 100).toFixed(0)}% whale score, suggesting they know what they're doing.`;
          }
          
          if (trade.side === 'buy' && marketData.probability < 0.3) {
            whaleSection += ` Buying into low odds shows real contrarian conviction.`;
          } else if (trade.side === 'sell' && marketData.probability > 0.7) {
            whaleSection += ` Selling into high odds suggests they see something others don't.`;
          }
        });
      }
    }
    
    // 添加持仓分析
    if (marketData.topHolders.length > 0) {
      const topHolder = marketData.topHolders[0];
      if (topHolder.position > 100000) {
        whaleSection += `\n\nThe largest position holder controls $${(topHolder.position / 1000).toFixed(0)}k worth of shares. `;
        if (topHolder.pnl > 0) {
          whaleSection += `They're currently up $${(topHolder.pnl / 1000).toFixed(0)}k, which explains their confidence.`;
        } else {
          whaleSection += `Despite being down $${Math.abs(topHolder.pnl / 1000).toFixed(0)}k, they're holding firm. That's conviction.`;
        }
      }
    }
    
    return whaleSection;
  }

  /**
   * 构建结论
   */
  private buildConclusion(marketData: MarketData, conclusionTemplate: string): string {
    let conclusion = conclusionTemplate;
    
    // 添加具体的行动建议
    const probability = marketData.probability;
    const whaleScore = marketData.whaleScore;
    
    if (probability > 0.7 && whaleScore > 0.7) {
      conclusion += `\n\nWith strong market consensus and whale backing, the path of least resistance appears to be higher. But remember - when everyone agrees, everyone can be wrong.`;
    } else if (probability < 0.3 && whaleScore > 0.7) {
      conclusion += `\n\nThe market says it's unlikely, but the whales are positioning for it anyway. Sometimes the best trades are the ones that make you uncomfortable.`;
    } else {
      conclusion += `\n\nThe mixed signals suggest this market is still finding its direction. Sometimes the best trade is no trade at all - until the picture becomes clearer.`;
    }
    
    // 添加风险提醒
    conclusion += `\n\n*This analysis is for informational purposes only. Prediction markets carry significant risk. Never invest more than you can afford to lose.*`;
    
    return conclusion;
  }

  /**
   * 生成标题
   */
  private generateTitle(marketData: MarketData): string {
    const probability = (marketData.probability * 100).toFixed(0);
    const eventName = marketData.title.split(':')[0] || marketData.title;
    
    const titleTemplates = [
      `${eventName}: ${probability}% Odds and What Smart Money Is Really Thinking`,
      `${eventName}: Why the Market Is Pricing ${probability}% Probability`,
      `${eventName}: Capital Flows, Whale Signals, and Market Intelligence`,
      `${eventName}: Separating Signal From Noise in Prediction Markets`,
      `${eventName}: What ${probability}% Odds Actually Mean for Traders`
    ];
    
    return this.selectRandom(titleTemplates);
  }

  /**
   * 生成摘要
   */
  private generateExcerpt(marketData: MarketData): string {
    const probability = (marketData.probability * 100).toFixed(1);
    const volumeText = marketData.volume > 100000 ? `with over $${(marketData.volume / 1000).toFixed(0)}k in volume` : 'gaining significant attention';
    
    const excerptTemplates = [
      `A deep dive into the Polymarket odds for ${marketData.title}, ${volumeText}, and what whale positioning reveals about market expectations.`,
      `Market intelligence on ${marketData.title}, currently trading at ${probability}% odds, with analysis of smart money flows and capital allocation patterns.`,
      `Understanding the ${probability}% probability priced into ${marketData.title}, including whale signals, volume analysis, and prediction market dynamics.`
    ];
    
    return this.selectRandom(excerptTemplates);
  }

  /**
   * 生成标签
   */
  private generateTags(marketData: MarketData): string[] {
    const baseTags = ['Market Analysis', 'Whale Intelligence', 'Polymarket'];
    
    // 根据市场内容添加特定标签
    const title = marketData.title.toLowerCase();
    if (title.includes('election') || title.includes('trump') || title.includes('biden')) {
      baseTags.push('Politics', 'Election Markets');
    }
    if (title.includes('bitcoin') || title.includes('crypto') || title.includes('solana')) {
      baseTags.push('Crypto', 'Digital Assets');
    }
    if (title.includes('sports') || title.includes('super bowl') || title.includes('world cup')) {
      baseTags.push('Sports', 'Sports Betting');
    }
    if (marketData.probability < 0.3) {
      baseTags.push('Contrarian Bets');
    }
    if (marketData.whaleScore > 0.7) {
      baseTags.push('Smart Money');
    }
    
    return [...new Set(baseTags)]; // 去重
  }

  /**
   * 计算阅读时间
   */
  private calculateReadTime(content: string): string {
    const words = content.split(/\s+/).length;
    const minutes = Math.ceil(words / 200); // 假设每分钟阅读200字
    return `${minutes} min`;
  }

  /**
   * 选择随机元素
   */
  private selectRandom<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * 获取市场事件描述
   */
  private getMarketEvent(marketData: MarketData): string {
    const title = marketData.title.toLowerCase();
    if (title.includes('election')) return 'the political horse race';
    if (title.includes('crypto') || title.includes('bitcoin')) return 'crypto volatility';
    if (title.includes('sports')) return 'the game everyone is watching';
    return 'the latest market moves';
  }

  /**
   * 获取市场情绪
   */
  private getMarketSentiment(probability: number): string {
    if (probability > 0.7) return 'overwhelmingly bullish';
    if (probability > 0.6) return 'moderately bullish';
    if (probability > 0.4) return 'evenly divided';
    if (probability > 0.3) return 'moderately bearish';
    return 'overwhelmingly bearish';
  }
}

// 导出实例
export const blogGenerator = new BlogContentGenerator();
