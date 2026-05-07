const BASE_URL = 'https://www.sightwhale.com';

export async function GET() {
  const content = [
    '# SightWhale',
    '',
    '> Polymarket whale signals with a public historical audit trail and paid real-time delivery.',
    '',
    '## Primary pages',
    `- ${BASE_URL}/`,
    `- ${BASE_URL}/history`,
    `- ${BASE_URL}/pricing`,
    `- ${BASE_URL}/subscribe`,
    '',
    '## Policy',
    '- Public marketing pages may be indexed and summarized.',
    '- API routes, auth surfaces, and private user data are not for indexing.',
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
