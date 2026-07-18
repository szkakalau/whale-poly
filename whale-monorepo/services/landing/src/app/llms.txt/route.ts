const BASE_URL = 'https://www.sightwhale.com';
const API_BASE = process.env.TRADE_INGEST_API_URL || 'https://sightwhale.onrender.com';

async function fetchRecentPosts(limit: number = 15): Promise<{ title: string; slug: string; language: string; published_at: string }[]> {
  try {
    const res = await fetch(`${API_BASE}/blog/posts?language=en&page=1&limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.posts || []).map((p: any) => ({
      title: p.title,
      slug: p.slug,
      language: p.language,
      published_at: p.published_at,
    }));
  } catch (err) {
    console.error('llms.txt: failed fetching blog posts', err);
    return [];
  }
}

export async function GET() {
  const posts = await fetchRecentPosts(15);

  const blogLines = posts.length > 0
    ? [
        '## Blog',
        '',
        ...posts.map((p) => `- [${p.title}](${BASE_URL}/blog/${p.language}/${p.slug})`),
        '',
      ]
    : ['## Blog', '', `- ${BASE_URL}/blog/en`, `- ${BASE_URL}/blog/zh`, ''];

  const content = [
    '# SightWhale — Polymarket Whale Intelligence',
    '',
    '> Real-time Polymarket whale tracking platform. Follow the top 1% most profitable wallets, receive scored Telegram alerts in ~30 seconds, and verify every signal on a permanent public audit trail.',
    '',
    '## Primary pages',
    `- ${BASE_URL}/ — Home: live signals, track record, FAQ`,
    `- ${BASE_URL}/about — About: team, principles, and contact`,
    `- ${BASE_URL}/pricing — Plans: Free / Pro ($29/mo) / Elite ($59/mo)`,
    `- ${BASE_URL}/history — Full audited signal history, publicly verifiable`,
    `- ${BASE_URL}/volume-analysis — Whale volume divergence vs market price`,
    `- ${BASE_URL}/methodology — How we identify and score whale wallets`,
    `- ${BASE_URL}/subscribe — Secure Stripe checkout`,
    '',
    ...blogLines,
    '## Feeds & discovery',
    `- Sitemap: ${BASE_URL}/sitemap.xml`,
    `- RSS: ${BASE_URL}/blog/feed.xml`,
    `- Robots: ${BASE_URL}/robots.txt`,
    `- Full context: ${BASE_URL}/llms-full.txt`,
    '',
    '## Policy',
    '- Public marketing pages may be indexed, crawled, and summarized.',
    '- API routes, auth surfaces, and private user data are not for indexing.',
    '- Content is informational only and not investment advice.',
    `- Last updated: ${new Date().toISOString().split('T')[0]}`,
  ].join('\n');

  return new Response(`${content}\n`, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
