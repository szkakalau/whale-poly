import { MetadataRoute } from 'next';

export const dynamic = 'force-dynamic'; // never cache — blog posts change frequently

const API_BASE = process.env.TRADE_INGEST_API_URL || 'https://sightwhale.onrender.com';

type PostMeta = {
  slug: string;
  language: string;
  published_at: string;
  group_slug: string | null;
};

async function fetchSlugs(language: string): Promise<PostMeta[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000); // 10 s timeout

  try {
    const res = await fetch(`${API_BASE}/blog/posts?language=${language}&limit=500`, {
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.posts || []) as PostMeta[];
  } finally {
    clearTimeout(timeout);
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.sightwhale.com';

  // Fixed dates for static pages — do NOT use `new Date()`.
  // Google uses lastmod to decide which pages to re-crawl. If every page
  // claims "updated now" every time, Google wastes crawl budget on unchanged
  // static pages and never reaches newly published blog posts.
  const SITE_LAUNCH = new Date('2025-07-01');    // static marketing pages
  const BLOG_LAUNCH = new Date('2026-07-15');     // blog listing pages (updated when new posts publish)

  const staticRoutes = [
    // High-value marketing + product pages
    { route: '',              lastmod: SITE_LAUNCH, priority: 1.0, freq: 'weekly' as const },
    { route: '/pricing',      lastmod: SITE_LAUNCH, priority: 0.9, freq: 'weekly' as const },
    { route: '/subscribe',    lastmod: SITE_LAUNCH, priority: 0.9, freq: 'weekly' as const },
    // Feature pages — updated as data refreshes
    { route: '/history',      lastmod: SITE_LAUNCH, priority: 0.8, freq: 'daily' as const },
    { route: '/volume-analysis', lastmod: SITE_LAUNCH, priority: 0.8, freq: 'daily' as const },
    { route: '/analyze',      lastmod: SITE_LAUNCH, priority: 0.8, freq: 'weekly' as const },
    // Informational pages
    { route: '/about',        lastmod: SITE_LAUNCH, priority: 0.7, freq: 'monthly' as const },
    { route: '/methodology',  lastmod: SITE_LAUNCH, priority: 0.7, freq: 'monthly' as const },
    { route: '/polymarket-alerts-tl', lastmod: SITE_LAUNCH, priority: 0.7, freq: 'monthly' as const },
    // Legal — rarely changes
    { route: '/terms',        lastmod: SITE_LAUNCH, priority: 0.3, freq: 'yearly' as const },
    { route: '/privacy',      lastmod: SITE_LAUNCH, priority: 0.3, freq: 'yearly' as const },
    // Blog listing — updated whenever new posts are published
    { route: '/blog/en',      lastmod: BLOG_LAUNCH, priority: 0.9, freq: 'daily' as const },
    { route: '/blog/zh',      lastmod: BLOG_LAUNCH, priority: 0.9, freq: 'daily' as const },
  ].map(
    ({ route, lastmod, priority, freq }) => ({
      url: `${baseUrl}${route}`,
      lastModified: lastmod,
      changeFrequency: freq,
      priority,
    }),
  );

  // Dynamic blog post routes — fetch directly (no Prisma, no blog.ts imports)
  const blogRoutes: MetadataRoute.Sitemap = [];

  // Fetch both languages in parallel
  const [enPosts, zhPosts] = await Promise.all([
    fetchSlugs('en').catch((err) => {
      console.error('[sitemap] Failed to fetch slugs for language=en:', err);
      return [] as PostMeta[];
    }),
    fetchSlugs('zh').catch((err) => {
      console.error('[sitemap] Failed to fetch slugs for language=zh:', err);
      return [] as PostMeta[];
    }),
  ]);

  // Build group_slug → language → slug map for hreflang alternates
  const groupMap = new Map<string, { en?: string; zh?: string }>();
  for (const post of [...enPosts, ...zhPosts]) {
    const key = post.group_slug || post.slug; // fallback to slug if no group_slug
    if (!groupMap.has(key)) groupMap.set(key, {});
    groupMap.get(key)![post.language as 'en' | 'zh'] = post.slug;
  }

  // EN posts — higher priority (primary language)
  for (const post of enPosts) {
    const key = post.group_slug || post.slug;
    const group = groupMap.get(key);
    blogRoutes.push({
      url: `${baseUrl}/blog/en/${post.slug}`,
      lastModified: new Date(post.published_at),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
      ...(group?.zh
        ? { alternates: { languages: { zh: `${baseUrl}/blog/zh/${group.zh}` } } }
        : {}),
    });
  }

  // ZH posts — standard priority
  for (const post of zhPosts) {
    const key = post.group_slug || post.slug;
    const group = groupMap.get(key);
    blogRoutes.push({
      url: `${baseUrl}/blog/zh/${post.slug}`,
      lastModified: new Date(post.published_at),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
      ...(group?.en
        ? { alternates: { languages: { en: `${baseUrl}/blog/en/${group.en}` } } }
        : {}),
    });
  }

  return [...staticRoutes, ...blogRoutes];
}
