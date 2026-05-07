import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.sightwhale.com';
  const now = new Date();

  const routes = ['', '/history', '/pricing', '/subscribe', '/terms', '/privacy', '/success', '/cancel'].map(
    (route) => ({
      url: `${baseUrl}${route}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: route === '' ? 1 : 0.8,
    }),
  );

  return routes;
}
