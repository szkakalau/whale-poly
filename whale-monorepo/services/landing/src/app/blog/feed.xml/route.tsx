import { getLatestPosts, type BlogPostCard } from '@/lib/blog';

export const dynamic = 'force-dynamic'; // DB query at runtime, CDN cache via Cache-Control header

export async function GET() {
  const siteUrl = 'https://www.sightwhale.com';

  // Separate feeds by language
  const [enPosts, zhPosts] = await Promise.all([
    getLatestPosts(15, 'en'),
    getLatestPosts(5, 'zh'),
  ]);

  const buildItem = (post: BlogPostCard) => `  <item>
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
