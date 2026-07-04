export const dynamic = 'force-dynamic'; // DB query at runtime, CDN cache via Cache-Control header

const API_BASE = process.env.TRADE_INGEST_API_URL || 'https://trade-ingest-api.onrender.com';

async function fetchPosts(language: string, limit: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(
      `${API_BASE}/blog/posts?language=${language}&limit=${limit}`,
      { signal: controller.signal },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.posts || []) as {
      slug: string; title: string; excerpt: string; tags: string[];
      published_at: string; language: string;
    }[];
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const siteUrl = 'https://www.sightwhale.com';

  const [enPosts, zhPosts] = await Promise.all([
    fetchPosts('en', 15),
    fetchPosts('zh', 5),
  ]);

  const buildItem = (post: { slug: string; title: string; excerpt: string; tags: string[]; published_at: string; language: string }) =>
    `  <item>
    <title><![CDATA[${post.title}]]></title>
    <link>${siteUrl}/blog/${post.language}/${post.slug}</link>
    <description><![CDATA[${post.excerpt}]]></description>
    <pubDate>${new Date(post.published_at).toUTCString()}</pubDate>
    <guid isPermaLink="true">${siteUrl}/blog/${post.language}/${post.slug}</guid>
    <category>${(post.tags || []).join(',')}</category>
  </item>`;

  const items = [...enPosts.map(buildItem), ...zhPosts.map(buildItem)].join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>SightWhale Blog — Polymarket Strategies &amp; Whale Insights</title>
    <link>${siteUrl}/blog</link>
    <description>In-depth articles on Polymarket trading strategies, whale tracking, prediction market theory, and SightWhale tools. Bilingual EN/ZH.</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/blog/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
