import { MetadataRoute } from 'next';

export const dynamic = 'force-dynamic'; // never cache — blog posts change frequently

const API_BASE = process.env.TRADE_INGEST_API_URL || 'https://trade-ingest-api.onrender.com';

async function fetchSlugs(language: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000); // 10 s timeout

  try {
    const res = await fetch(`${API_BASE}/blog/posts?language=${language}&limit=500`, {
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.posts || []) as { slug: string; language: string; published_at: string }[];
  } finally {
    clearTimeout(timeout);
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.sightwhale.com';
  const now = new Date();

  const staticRoutes = [
    '',
    '/analyze',
    '/history',
    '/pricing',
    '/polymarket-alerts-tl',
    '/volume-analysis',
    '/terms',
    '/privacy',
    '/blog/en',
    '/blog/zh',
  ].map(
    (route) => ({
      url: `${baseUrl}${route}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: route === '' ? 1 : route.startsWith('/blog') ? 0.9 : 0.8,
    }),
  );

  // Dynamic blog post routes — fetch directly (no Prisma, no blog.ts imports)
  let blogRoutes: MetadataRoute.Sitemap = [];
  for (const lang of ['en', 'zh']) {
    try {
      const posts = await fetchSlugs(lang);
      for (const post of posts) {
        blogRoutes.push({
          url: `${baseUrl}/blog/${post.language}/${post.slug}`,
          lastModified: new Date(post.published_at),
          changeFrequency: 'weekly' as const,
          priority: 0.7,
        });
      }
    } catch (err) {
      console.error(`[sitemap] Failed to fetch slugs for language=${lang}:`, err);
    }
  }

  return [...staticRoutes, ...blogRoutes];
}
