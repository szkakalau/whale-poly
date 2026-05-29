/**
 * NL Matcher — resolves natural language market queries to Polymarket markets
 * using the Gamma API search endpoint.
 *
 * Phase 2: Gamma API keyword search.
 * Phase 3+: cross-lingual, semantic embeddings (deferred).
 */

const GAMMA_MARKETS_URL = 'https://gamma-api.polymarket.com/markets';

export type MarketMatch = {
  slug: string;
  title: string;
  conditionId: string;
  outcomes: string[];
  outcomePrices: number[];
  closed: boolean;
  volume24h?: number;
};

function safeString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function safeNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseGammaMarketRow(row: Record<string, unknown>): MarketMatch | null {
  const title = safeString(row.title || row.question || '');
  const conditionId = safeString(row.conditionId || row.condition_id || '');
  if (!title || !conditionId) return null;

  const outcomes: string[] = Array.isArray(row.outcomes)
    ? row.outcomes.map((o: unknown) => safeString(o))
    : [];
  const outcomePrices: number[] = Array.isArray(row.outcomePrices)
    ? row.outcomePrices.map((p: unknown) => safeNumber(p))
    : [];

  const slug = safeString(row.slug || '');
  const closed = row.closed === true || row.closed === 'true' || row.active === false;
  const volume24h = safeNumber((row as Record<string, unknown>).volume24hr || (row as Record<string, unknown>).volume24h || (row as Record<string, unknown>).volume);

  return { slug, title, conditionId, outcomes, outcomePrices, closed, volume24h };
}

/**
 * Search Gamma API for markets matching a natural-language query.
 * Returns up to `limit` open markets, sorted by 24h volume descending.
 */
export async function searchMarkets(query: string, limit = 5): Promise<MarketMatch[]> {
  const q = query.trim().slice(0, 200);
  if (!q) return [];

  try {
    const url = new URL(GAMMA_MARKETS_URL);
    url.searchParams.set('title', q);
    url.searchParams.set('limit', String(Math.max(limit, 10))); // fetch extra for filtering
    url.searchParams.set('order', 'volume24hr');
    url.searchParams.set('ascending', 'false');
    // Only open markets
    url.searchParams.set('closed', 'false');

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      next: { revalidate: 120 },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return [];

    const matches: MarketMatch[] = [];
    for (const row of data) {
      if (!row || typeof row !== 'object') continue;
      const m = parseGammaMarketRow(row as Record<string, unknown>);
      if (m && !m.closed) {
        matches.push(m);
      }
    }
    return matches.slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Given a query that IS already a polymarket.com URL, extract the event slug.
 */
export function extractSlugFromUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/polymarket\.com\/event\/([^/?\s]+)/i);
  return match ? match[1] : null;
}

import { translateQuery } from './nl-translate';

/**
 * Match a user query to the best market.
 * Priority:
 *  1. Direct URL → extract slug
 *  2. Gamma API title search → best match by volume
 *  3. null if nothing found
 */
export async function resolveMarketSlug(query: string): Promise<{
  slug: string | null;
  candidates: MarketMatch[];
  matched: 'url' | 'search' | 'none';
}> {
  // 1. URL extraction
  const urlSlug = extractSlugFromUrl(query);
  if (urlSlug) {
    // Validate it exists in Gamma
    const markets = await searchMarkets(urlSlug, 1);
    if (markets.length > 0) {
      return { slug: urlSlug, candidates: markets, matched: 'url' };
    }
    // URL slug not found in Gamma — still use it (DB may have data)
    return { slug: urlSlug, candidates: [], matched: 'url' };
  }

  // 2. Gamma API search
  let candidates = await searchMarkets(query, 5);

  // 2.5 Cross-lingual fallback: if no results, try English translation
  if (candidates.length === 0) {
    const translated = translateQuery(query);
    if (translated !== query) {
      candidates = await searchMarkets(translated, 5);
    }
  }

  if (candidates.length === 0) {
    return { slug: null, candidates: [], matched: 'none' };
  }

  // Use the top result's slug
  return {
    slug: candidates[0].slug || query, // fallback to raw query if no slug
    candidates,
    matched: 'search',
  };
}
