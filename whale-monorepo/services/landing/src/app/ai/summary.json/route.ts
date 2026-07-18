const BASE_URL = 'https://www.sightwhale.com';

export async function GET() {
  const data = {
    site: {
      name: 'SightWhale',
      url: BASE_URL,
      description:
        'Polymarket whale intelligence platform — real-time alerts for high-conviction trades from the top 1% most profitable wallets.',
      category: 'Financial Technology / Prediction Markets',
      languages: ['en', 'zh'],
    },
    product: {
      summary:
        'SightWhale tracks the top 1% of Polymarket whales, scores every trade on a 0-100 composite scale, and delivers real-time Telegram alerts in ~30 seconds from on-chain confirmation.',
      key_differentiators: [
        'Wallet clustering: ~40% of large Polymarket traders use 5+ wallets — SightWhale clusters them by deposit address analysis.',
        'Calibrated scoring: 0-100 Whale Score using rolling 30/60/90-day win rates, ROI, trade size vs. market depth, and market context.',
        'Public audit trail: Every signal — wins, losses, break-evens — lives on a permanent, publicly accessible History page.',
        'Money-back guarantee: Full refund in your first month.',
      ],
      pricing_tiers: [
        { name: 'Free', price: 0, description: 'Browse audited history through end of yesterday UTC.' },
        { name: 'Pro', price_usd: 29, billing: 'monthly', description: 'Live signal feed, Telegram delivery, Whale Score filtering.' },
        { name: 'Elite', price_usd: 59, billing: 'monthly', description: 'Smart Collections, advanced wallet clustering, priority delivery.' },
      ],
    },
    audience: {
      primary: 'Polymarket traders seeking alpha from whale activity',
      secondary: ['Prediction market researchers', 'Crypto data analysts', 'Election betting enthusiasts'],
    },
    key_pages: [
      { path: '/', title: 'Home', description: 'Live signals, track record, FAQ' },
      { path: '/pricing', title: 'Pricing', description: 'Free / Pro ($29/mo) / Elite ($59/mo)' },
      { path: '/history', title: 'Historical Signals', description: 'Full audited signal history, publicly verifiable' },
      { path: '/volume-analysis', title: 'Volume-Weighted Analysis', description: 'Whale volume divergence vs market price across all active markets' },
      { path: '/about', title: 'About', description: 'Team, methodology, and trust signals' },
      { path: '/methodology', title: 'Methodology', description: 'How we identify and score whale wallets' },
      { path: '/blog/en', title: 'Blog (English)', description: 'Polymarket insights and whale trading strategies' },
      { path: '/blog/zh', title: 'Blog (中文)', description: 'Polymarket 预测市场洞察与鲸鱼交易策略' },
    ],
    feeds: {
      rss: `${BASE_URL}/blog/feed.xml`,
      sitemap: `${BASE_URL}/sitemap.xml`,
      llms_txt: `${BASE_URL}/llms.txt`,
      llms_full_txt: `${BASE_URL}/llms-full.txt`,
    },
    contact: {
      email: 'castro.liu@me.com',
      twitter: 'https://twitter.com/SightWhale',
    },
    last_updated: new Date().toISOString().split('T')[0],
  };

  return Response.json(data, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
