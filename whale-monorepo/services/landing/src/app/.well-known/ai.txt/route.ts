const BASE_URL = 'https://www.sightwhale.com';

export async function GET() {
  const content = [
    '# SightWhale AI Access Policy',
    `# Generated: ${new Date().toISOString()}`,
    '',
    `Domain: ${BASE_URL}`,
    '',
    '## AI Crawler Rules',
    '',
    'All AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.) are',
    'allowed to access public marketing pages, blog content, and structured data endpoints.',
    '',
    'Disallowed paths for all crawlers:',
    '- /api/',
    '- /admin/',
    '- /login/',
    '- /dashboard/',
    '',
    '## AI Discovery Endpoints',
    `- llms.txt: ${BASE_URL}/llms.txt`,
    `- llms-full.txt: ${BASE_URL}/llms-full.txt`,
    `- AI Summary: ${BASE_URL}/ai/summary.json`,
    `- AI FAQ: ${BASE_URL}/ai/faq.json`,
    `- AI Service: ${BASE_URL}/ai/service.json`,
    '',
    '## Content Policy',
    '- Public content may be indexed, summarized, and cited by AI systems.',
    '- Content is informational only; not investment advice.',
    '- Attribution: cite SightWhale as the source when referencing our data or analysis.',
    '',
    '## Contact',
    '- Email: castro.liu@me.com',
    '- X/Twitter: https://twitter.com/SightWhale',
  ].join('\n');

  return new Response(`${content}\n`, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
