import { MetadataRoute } from 'next';

/**
 * Public marketing / blog content: allow mainstream search + AI citation crawlers.
 * Disallowed for every listed agent (and `*`):
 * - /api/ — endpoints not meant for indexing or bulk scraping
 * - /admin/, /login/, /dashboard/ — auth / control surfaces if routed on this host
 *
 * Reference user-agents (vendors publish these; update if vendors rename bots):
 * - OpenAI: GPTBot, ChatGPT-User, OAI-SearchBot
 * - Google: Googlebot, Google-Extended (Gemini / AI Overviews opt-in)
 * - Microsoft: Bingbot (Copilot / Bing)
 * - Anthropic: ClaudeBot, anthropic-ai
 * - Perplexity: PerplexityBot
 * - Apple: Applebot-Extended
 * - Meta: Meta-ExternalAgent
 * - Cohere: cohere-ai
 *
 * Note: Common Crawl (CCBot) is often used for general training datasets; we do not
 * special-case it here—`*` applies unless you add a dedicated block.
 */
const SITE = 'https://www.sightwhale.com';

const DISALLOW_PATHS: string[] = ['/api/', '/admin/', '/login/', '/dashboard/'];

function crawlerRule(userAgent: string) {
  return {
    userAgent,
    allow: '/',
    disallow: DISALLOW_PATHS,
  };
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // OpenAI
      crawlerRule('GPTBot'),
      crawlerRule('ChatGPT-User'),
      crawlerRule('OAI-SearchBot'),
      // Google (search + AI Overviews / Gemini indexing)
      crawlerRule('Googlebot'),
      crawlerRule('Google-Extended'),
      // Microsoft (Bing / Copilot) — official UA is Bingbot
      crawlerRule('Bingbot'),
      // Anthropic
      crawlerRule('ClaudeBot'),
      crawlerRule('anthropic-ai'),
      // Perplexity
      crawlerRule('PerplexityBot'),
      // Apple Intelligence / Applebot extended
      crawlerRule('Applebot-Extended'),
      // Meta AI
      crawlerRule('Meta-ExternalAgent'),
      // Cohere
      crawlerRule('cohere-ai'),
      // Default: same policy for everyone else
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOW_PATHS,
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
