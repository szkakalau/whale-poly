const BASE_URL = 'https://www.sightwhale.com';

export async function GET() {
  const content = [
    '# SightWhale',
    '',
    '> Real-time whale tracking and smart-money signal workflows for Polymarket.',
    '',
    '## Primary Pages',
    `- ${BASE_URL}/`,
    `- ${BASE_URL}/polymarket-alerts-tl`,
    `- ${BASE_URL}/smart-money`,
    `- ${BASE_URL}/smart-collections`,
    `- ${BASE_URL}/follow`,
    `- ${BASE_URL}/subscribe`,
    '',
    '## Policy',
    '- Public marketing, product, and blog pages may be indexed and summarized.',
    '- API routes, auth/control surfaces, and private user data are not for indexing.',
    '- Content is informational only and not investment advice.',
    '',
    '## More',
    `- Full context: ${BASE_URL}/llms-full.txt`,
    `- Sitemap: ${BASE_URL}/sitemap.xml`,
    `- Robots: ${BASE_URL}/robots.txt`,
  ].join('\n');

  return new Response(`${content}\n`, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
