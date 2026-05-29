/**
 * Cross-lingual NL matching — Phase 2 extension.
 *
 * Maps Chinese/非英语 queries to English Polymarket market search terms.
 * Uses a keyword dictionary for common prediction market topics.
 * Falls back to direct Gamma API search.
 */

const ZH_EN_MAP: Record<string, string> = {
  // Politics / 政治
  '特朗普': 'Trump',
  '川普': 'Trump',
  '拜登': 'Biden',
  '哈里斯': 'Harris',
  '选举': 'election',
  '大选': 'presidential election',
  '总统': 'president',
  '国会': 'congress',
  '参议院': 'senate',
  '众议院': 'house',
  '共和党': 'Republican',
  '民主党': 'Democrat',
  '就职': 'inauguration',
  '弹劾': 'impeachment',
  '关税': 'tariff',
  '贸易战': 'trade war',
  '移民': 'immigration',
  '边境': 'border',
  '内阁': 'cabinet',
  '最高法院': 'Supreme Court',
  '联邦储备': 'Federal Reserve',
  '鲍威尔': 'Powell',
  '降息': 'rate cut',
  '加息': 'rate hike',
  '通胀': 'inflation',
  '经济衰退': 'recession',
  'GDP': 'GDP',
  '就业': 'jobs',
  '非农': 'nonfarm payroll',
  '失业': 'unemployment',
  '财政': 'fiscal',
  '债务': 'debt',
  '赤字': 'deficit',
  '政府': 'government',
  '停摆': 'shutdown',
  '预算': 'budget',
  '税': 'tax',
  '减税': 'tax cut',

  // Crypto / 加密货币
  '比特币': 'Bitcoin',
  '以太坊': 'Ethereum',
  '以太': 'ETH',
  '加密货币': 'crypto',
  '区块链': 'blockchain',
  '山寨币': 'altcoin',
  '稳定币': 'stablecoin',
  'DeFi': 'DeFi',
  'NFT': 'NFT',
  '挖矿': 'mining',
  '减半': 'halving',
  'ETF': 'ETF',
  'SEC': 'SEC',
  '监管': 'regulation',
  '交易所': 'exchange',
  '钱包': 'wallet',
  '空投': 'airdrop',
  '代币': 'token',
  'Solana': 'Solana',
  '币安': 'Binance',
  'Coinbase': 'Coinbase',

  // Sports / 体育
  '超级碗': 'Super Bowl',
  'NFL': 'NFL',
  'NBA': 'NBA',
  '总冠军': 'championship',
  '世界杯': 'World Cup',
  '奥运会': 'Olympics',
  '英超': 'Premier League',
  '欧冠': 'Champions League',
  'UFC': 'UFC',
  '拳击': 'boxing',
  'F1': 'Formula 1',
  '网球': 'tennis',
  '大满贯': 'Grand Slam',

  // Finance / 金融
  '标普': 'S&P 500',
  '纳斯达克': 'NASDAQ',
  '道琼斯': 'Dow Jones',
  '股市': 'stock market',
  '股指': 'index',
  '黄金': 'gold',
  '石油': 'oil',
  '原油': 'crude oil',
  '天然气': 'natural gas',
  '铜': 'copper',
  '白银': 'silver',
  '美元': 'USD',
  '人民币': 'CNY',
  '欧元': 'EUR',
  '日元': 'JPY',
  '汇率': 'exchange rate',
  '国债': 'treasury',
  '收益率': 'yield',
  '债券': 'bond',
  '大宗商品': 'commodity',
  'VIX': 'VIX',
  '波动率': 'volatility',

  // Tech / 科技
  '人工智能': 'AI',
  'ChatGPT': 'ChatGPT',
  'OpenAI': 'OpenAI',
  'AGI': 'AGI',
  '英伟达': 'Nvidia',
  '苹果': 'Apple',
  '谷歌': 'Google',
  '微软': 'Microsoft',
  '特斯拉': 'Tesla',
  'Meta': 'Meta',
  '亚马逊': 'Amazon',
  '马斯克': 'Musk',
  '芯片': 'chip',
  '半导体': 'semiconductor',
  '量子': 'quantum',
  '核聚变': 'nuclear fusion',
  '火星': 'Mars',
  'SpaceX': 'SpaceX',
  '自动驾驶': 'autonomous driving',
  '机器人': 'robot',

  // Weather / 天气
  '飓风': 'hurricane',
  '台风': 'typhoon',
  '地震': 'earthquake',
  '气温': 'temperature',
  '气候': 'climate',

  // General indicators
  '上涨': 'up',
  '下跌': 'down',
  '突破': 'break',
  '超过': 'above',
  '低于': 'below',
  '达到': 'reach',
  '价格': 'price',
  '预测': 'prediction',
  '概率': 'probability',
  '市场': 'market',
  '交易': 'trade',
  '预测市场': 'prediction market',
};

/**
 * Detect if query is primarily Chinese (or other non-English).
 */
function isChineseQuery(query: string): boolean {
  return /[一-鿿]/.test(query);
}

/**
 * Translate Chinese keywords to English search terms.
 * Keeps original English words intact, translates Chinese segments.
 */
export function translateQuery(query: string): string {
  if (!isChineseQuery(query)) return query;

  // Try longest-match-first: replace known Chinese terms with English
  const sorted = Object.entries(ZH_EN_MAP).sort((a, b) => b[0].length - a[0].length);
  let result = query;

  for (const [zh, en] of sorted) {
    if (result.includes(zh)) {
      // Replace first occurrence only to avoid over-translation
      result = result.replace(zh, en);
    }
  }

  // Remove any remaining Chinese characters that weren't matched
  result = result.replace(/[一-鿿]+/g, '').trim();

  // If we stripped everything, use the original English replacements
  if (!result) {
    for (const [zh, en] of sorted) {
      if (query.includes(zh)) return en;
    }
    return query;
  }

  return result || query;
}
