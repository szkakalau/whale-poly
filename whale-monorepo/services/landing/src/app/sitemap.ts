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
  const now = new Date();

  const staticRoutes = [
    '',
    '/about',
    '/history',
    '/methodology',
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
