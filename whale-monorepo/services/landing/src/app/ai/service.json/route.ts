export async function GET() {
  const data = {
    service: {
      name: 'SightWhale',
      tagline: 'Follow Smart Money on Polymarket',
      url: 'https://www.sightwhale.com',
      category: 'Financial Data & Alerts',
      platform: 'Web + Telegram',
      founded: '2025',
      status: 'active',
    },
    description:
      'SightWhale is a Polymarket whale intelligence platform that tracks the top 1% most profitable wallets, scores every trade on a 0-100 composite scale, and delivers real-time Telegram alerts. Every signal — wins, losses, break-evens — is published on a permanent public audit trail.',
    capabilities: [
      {
        name: 'Whale Trade Monitoring',
        description: '24/7 real-time monitoring of top 1% Polymarket wallets across 500+ markets.',
        availability: 'Pro, Elite',
      },
      {
        name: 'Whale Score',
        description: 'Composite 0-100 signal quality score using win rate, ROI, size, and market context.',
        availability: 'All plans',
      },
      {
        name: 'Telegram Alerts',
        description: 'Real-time push delivery in ~30 seconds from on-chain confirmation.',
        availability: 'Pro, Elite',
      },
      {
        name: 'Market Analysis',
        description: 'Live whale lookup for any Polymarket market via /analyze.',
        availability: 'All plans',
      },
      {
        name: 'Wallet Clustering',
        description: 'Advanced clustering of related wallets by shared deposit addresses.',
        availability: 'Elite',
      },
      {
        name: 'Smart Collections',
        description: 'Curated wallet groups by market category for targeted signal filtering.',
        availability: 'Elite',
      },
    ],
    pricing: {
      model: 'Subscription',
      tiers: [
        { name: 'Free', price_usd: 0, features: ['Historical signals', 'Basic market analysis'] },
        { name: 'Pro', price_usd: 29, billing: 'monthly', features: ['Real-time signals', 'Telegram delivery', 'Whale Score filtering'] },
        { name: 'Elite', price_usd: 59, billing: 'monthly', features: ['Smart Collections', 'Advanced clustering', 'Priority delivery'] },
      ],
      guarantee: 'Full refund in first month if not satisfied.',
    },
    trust_signals: {
      audit_trail: 'Permanent public history of all signals — wins, losses, and break-evens.',
      on_chain_verification: 'All trades are verifiable on the Polymarket blockchain.',
      money_back_guarantee: true,
    },
    contact: {
      email: 'castro.liu@me.com',
      twitter: 'https://twitter.com/SightWhale',
    },
    ai_endpoints: {
      'llms.txt': 'https://www.sightwhale.com/llms.txt',
      'llms-full.txt': 'https://www.sightwhale.com/llms-full.txt',
      'ai.txt': 'https://www.sightwhale.com/.well-known/ai.txt',
      'summary.json': 'https://www.sightwhale.com/ai/summary.json',
      'faq.json': 'https://www.sightwhale.com/ai/faq.json',
      'service.json': 'https://www.sightwhale.com/ai/service.json',
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
