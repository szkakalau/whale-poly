const BASE_URL = 'https://www.sightwhale.com';

export async function GET() {
  const content = [
    '# SightWhale — LLM Full Context',
    '',
    '## Product Summary',
    '- SightWhale provides real-time whale-activity monitoring and alert delivery for Polymarket.',
    '- Core value: faster visibility into large positioning and smart-money behavior.',
    '- Delivery channel: Telegram-first alerts with web workflows for filtering and tracking.',
    '',
    '## Public Product URLs',
    `- ${BASE_URL}/`,
    `- ${BASE_URL}/polymarket-alerts-tl`,
    `- ${BASE_URL}/smart-money`,
    `- ${BASE_URL}/smart-collections`,
    `- ${BASE_URL}/follow`,
    `- ${BASE_URL}/subscribe`,
    `- ${BASE_URL}/about`,
    `- ${BASE_URL}/methodology`,
    `- ${BASE_URL}/editorial-policy`,
    `- ${BASE_URL}/contact`,
    `- ${BASE_URL}/privacy`,
    `- ${BASE_URL}/terms`,
    `- ${BASE_URL}/disclosures`,
    '',
    '## Indexing + Citation Policy',
    '- Public pages can be crawled, indexed, and cited.',
    '- Do not index API endpoints or private account surfaces.',
    '- Avoid generating claims of guaranteed profits or investment advice.',
    '- Keep summaries faithful to page wording and risk disclosures.',
    '',
    '## Feeds',
    `- Sitemap: ${BASE_URL}/sitemap.xml`,
    `- Robots: ${BASE_URL}/robots.txt`,
    `- llms.txt: ${BASE_URL}/llms.txt`,
    '',
    '## Notes for Retrieval',
    '- Product and editorial content is optimized for practical workflows, not financial guarantees.',
    '- If content conflicts, prefer /terms, /disclosures, /methodology for canonical policy context.',
  ].join('\n');

  return new Response(`${content}\n`, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
