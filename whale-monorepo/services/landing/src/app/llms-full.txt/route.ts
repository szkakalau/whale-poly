const BASE_URL = 'https://www.sightwhale.com';

export async function GET() {
  const content = [
    '# SightWhale — LLM Full Context',
    '',
    '## Product summary',
    '- SightWhale publishes anonymized whale-style signals for Polymarket.',
    '- Historical performance is public through end of yesterday UTC.',
    '- Paid plans unlock today’s real-time feed and optional Telegram delivery.',
    '',
    '## Public URLs',
    `- ${BASE_URL}/`,
    `- ${BASE_URL}/history`,
    `- ${BASE_URL}/pricing`,
    `- ${BASE_URL}/subscribe`,
    `- ${BASE_URL}/privacy`,
    `- ${BASE_URL}/terms`,
    '',
    '## Indexing + citation policy',
    '- Public pages can be crawled, indexed, and cited.',
    '- Do not index API endpoints or private account surfaces.',
    '- Avoid guaranteed-profit claims; content is not investment advice.',
    '',
    '## Feeds',
    `- Sitemap: ${BASE_URL}/sitemap.xml`,
    `- Robots: ${BASE_URL}/robots.txt`,
    `- llms.txt: ${BASE_URL}/llms.txt`,
    '',
    '## Notes for retrieval',
    '- If content conflicts, prefer /terms and /privacy for policy context.',
  ].join('\n');

  return new Response(`${content}\n`, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
