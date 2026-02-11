import { MetadataRoute } from 'next';
import { getAllFilePosts, getAllPosts } from '@/lib/blog';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://sightwhale.com';
  let posts = getAllFilePosts();
  try {
    posts = await getAllPosts();
  } catch {
    posts = getAllFilePosts();
  }

  const blogUrls = posts.map((post) => {
    const lastModifiedDate = new Date(post.date);
    const lastModified = Number.isFinite(lastModifiedDate.getTime()) ? lastModifiedDate : undefined;
    return {
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    };
  });

  const routes = [
    '',
    '/blog',
    '/backtesting',
    '/conviction',
    '/subscribe',
    '/follow',
    '/smart-collections',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  return [...routes, ...blogUrls];
}
