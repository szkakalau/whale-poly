import { MetadataRoute } from 'next';

/**
 * Public marketing / blog content: allow mainstream search + AI citation crawlers.
 * API routes stay disallowed for all agents (no indexing / no bulk scraping of endpoints).
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
const DISALLOW_PATHS = ['/api/'];

function allowSiteExceptApi(userAgent: string) {
  return {
    userAgent,
    allow: '/',
    disallow: DISALLOW_PATHS,
  } as const;
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // OpenAI
      allowSiteExceptApi('GPTBot'),
      allowSiteExceptApi('ChatGPT-User'),
      allowSiteExceptApi('OAI-SearchBot'),
      // Google (search + AI Overviews / Gemini indexing)
      allowSiteExceptApi('Googlebot'),
      allowSiteExceptApi('Google-Extended'),
      // Microsoft (Bing / Copilot)
      allowSiteExceptApi('Bingbot'),
      // Anthropic
      allowSiteExceptApi('ClaudeBot'),
      allowSiteExceptApi('anthropic-ai'),
      // Perplexity
      allowSiteExceptApi('PerplexityBot'),
      // Apple Intelligence / Applebot extended
      allowSiteExceptApi('Applebot-Extended'),
      // Meta AI
      allowSiteExceptApi('Meta-ExternalAgent'),
      // Cohere
      allowSiteExceptApi('cohere-ai'),
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
