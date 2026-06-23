import { MetadataRoute } from 'next';
import { getAllPublishedSlugs } from '@/lib/blog';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.sightwhale.com';
  const now = new Date();

  const staticRoutes = [
    '',
    '/history',
    '/pricing',
    '/subscribe',
    '/polymarket-alerts-tl',
    '/terms',
    '/privacy',
    '/success',
    '/cancel',
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

  // Dynamic blog post routes
  let blogRoutes: MetadataRoute.Sitemap = [];
  try {
    const posts = await getAllPublishedSlugs();
    blogRoutes = posts.map((post) => ({
      url: `${baseUrl}/blog/${post.language}/${post.slug}`,
      lastModified: new Date(post.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
  } catch {
    // blog_posts table may not exist yet; skip
  }

  return [...staticRoutes, ...blogRoutes];
}
