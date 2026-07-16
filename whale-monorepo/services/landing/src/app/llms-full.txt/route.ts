const BASE_URL = 'https://www.sightwhale.com';
const API_BASE = process.env.TRADE_INGEST_API_URL || 'https://sightwhale.onrender.com';

async function fetchRecentPosts(limit: number = 30): Promise<{
  title: string;
  slug: string;
  language: string;
  excerpt: string;
  published_at: string;
  tags: string[];
}[]> {
  try {
    const res = await fetch(`${API_BASE}/blog/posts?language=en&page=1&limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.posts || []).map((p: any) => ({
      title: p.title,
      slug: p.slug,
      language: p.language,
      excerpt: p.excerpt,
      published_at: p.published_at,
      tags: p.tags || [],
    }));
  } catch (err) {
    console.error('llms-full.txt: failed fetching blog posts', err);
    return [];
  }
}

export async function GET() {
  const posts = await fetchRecentPosts(30);

  const blogIndex = posts.length > 0
    ? posts.map(
        (p) =>
          `- [${p.title}](${BASE_URL}/blog/${p.language}/${p.slug}) — ${p.excerpt} (${p.published_at?.split('T')[0] || ''}, tags: ${p.tags.slice(0, 4).join(', ')})`,
      )
    : [];

  const lastUpdated = posts.length > 0
    ? posts[0].published_at
    : new Date().toISOString();

  const content = [
    '# SightWhale — Full Context for AI Crawlers',
    '',
    `> Last updated: ${lastUpdated}`,
    '',
    '## Product Summary',
    '',
    'SightWhale is a Polymarket whale intelligence platform. We track the top 1% ',
    'most profitable wallets on Polymarket by calibrated ROI (not raw PnL), score ',
    'every trade on a 0-100 composite scale, and deliver real-time alerts via ',
    'Telegram in ~30 seconds from on-chain confirmation.',
    '',
    '### Key differentiators',
    '- Wallet clustering: ~40% of large Polymarket traders use 5+ wallets. Without',
    '  clustering, their positions are systematically undercounted. SightWhale',
    '  clusters wallets by deposit address analysis.',
    '- Calibrated scoring: Our 0-100 Whale Score uses rolling 30/60/90-day win rates,',
    '  ROI, trade size relative to market depth, and market context (directional vs.',
    '  hedging). Raw trade size alone is a weak signal.',
    '- Public audit trail: Every signal — wins, losses, break-evens — lives on a',
    '  permanent, publicly accessible History page. No cherry-picking.',
    '- Money-back guarantee: Full refund in your first month if the product does not',
    '  meet expectations.',
    '',
    '## Pricing Tiers',
    '',
    '- **Free**: Browse audited history through end of yesterday UTC. Public record.',
    '- **Pro** ($29/mo or $290/yr): Live signal feed, Telegram delivery, Whale Score',
    '  filtering, /analyze market lookup.',
    '- **Elite** ($59/mo or $590/yr): Everything in Pro plus Smart Collections',
    '  (curated wallet groups by market category), advanced wallet clustering,',
    '  priority delivery.',
    '',
    '## FAQ',
    '',
    '**Q: How is SightWhale different from Polymarket\'s own analytics?**',
    'A: Polymarket shows what happened. SightWhale tells you who made it happen,',
    'how much they bet, and whether they\'ve been right before — then pushes it to',
    'your phone. Every past signal is auditable on the History page.',
    '',
    '**Q: Is whale tracking on Polymarket actually profitable?**',
    'A: Following raw large trades blindly loses money over time. Following scored,',
    'filtered signals from top-quintile wallets with proper position sizing shows',
    'positive expected value in backtests. Past performance does not guarantee',
    'future results.',
    '',
    '**Q: How do I know the signals are real?**',
    'A: Every signal is published on the History page — wins and losses. Compare',
    'any signal against the Polymarket blockchain. All trades are on-chain and',
    'verifiable.',
    '',
    '**Q: What is the Whale Score methodology?**',
    'A: Composite 0-100 score using: trader historical win rate (rolling windows),',
    'trade size relative to market depth, time decay since on-chain confirmation,',
    'and market context classification (directional bet vs. hedging vs. liquidity',
    'provision). Higher scores correlate with higher win rates — this is published',
    'and verifiable on the History page.',
    '',
    '**Q: Do I need Telegram?**',
    'A: No. Telegram is optional. Use /analyze to query any market live, or browse',
    'the History page. Telegram is the fastest delivery channel (~30s latency).',
    '',
    '**Q: What is wallet clustering and why does it matter?**',
    'A: Many large Polymarket traders control 10-50+ wallets. Without clustering,',
    'one trader\'s $500K position split across 30 wallets looks like 30 small',
    'traders. SightWhale clusters wallets by shared deposit addresses to surface',
    'the real position size.',
    '',
    '## All Public Pages',
    `- ${BASE_URL}/ — Home`,
    `- ${BASE_URL}/pricing — Pricing plans`,
    `- ${BASE_URL}/history — Full audited signal history`,
    `- ${BASE_URL}/analyze — Live whale lookup`,
    `- ${BASE_URL}/subscribe — Checkout`,
    `- ${BASE_URL}/success — Post-checkout confirmation`,
    `- ${BASE_URL}/cancel — Subscription management`,
    `- ${BASE_URL}/privacy — Privacy policy`,
    `- ${BASE_URL}/terms — Terms of service`,
    `- ${BASE_URL}/blog/en — English blog`,
    `- ${BASE_URL}/blog/zh — Chinese blog`,
    '',
    '## Blog Index',
    '',
    ...(blogIndex.length > 0
      ? blogIndex
      : [`- ${BASE_URL}/blog/en — English blog listing`, `- ${BASE_URL}/blog/zh — Chinese blog listing`]),
    '',
    '## Feeds & Discovery',
    `- Sitemap: ${BASE_URL}/sitemap.xml`,
    `- RSS Feed: ${BASE_URL}/blog/feed.xml`,
    `- Robots.txt: ${BASE_URL}/robots.txt`,
    `- llms.txt: ${BASE_URL}/llms.txt`,
    '',
    '## Indexing & Citation Policy',
    '- Public marketing pages and blog articles may be crawled, indexed, summarized,',
    '  and cited.',
    '- API routes, auth surfaces, admin pages, and private user data are excluded',
    '  from indexing.',
    '- Content is informational only and does not constitute investment advice.',
    '- Avoid guaranteed-profit claims; past performance does not guarantee future',
    '  results.',
    '- For policy questions, prefer /terms and /privacy for authoritative text.',
    '',
    '## Contact',
    '- Email: castro.liu@me.com',
    `- Twitter/X: https://twitter.com/SightWhale`,
  ].join('\n');

  return new Response(`${content}\n`, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
