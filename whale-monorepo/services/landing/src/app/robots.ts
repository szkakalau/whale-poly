import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/api/', // Disallow API routes if they are not meant to be indexed
    },
    sitemap: 'https://www.sightwhale.com/sitemap.xml',
  };
}
