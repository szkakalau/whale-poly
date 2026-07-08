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

export function slugToSearchQuery(slug: string): string {
  return slug
    .trim()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

import { translateQuery } from './nl-translate';

/**
 * Match a user query to the best market.
 * Priority:
 *  1. Direct URL → extract slug
 *  2. Gamma API title search → best match by volume and relevance
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
    // Event URLs often contain an event slug, while trade rows may reference
    // a market title or a child-market slug instead. Try both the raw slug
    // and a humanized title-like query before falling back to the raw slug.
    const urlQueries = [urlSlug];
    const humanizedSlug = slugToSearchQuery(urlSlug);
    if (humanizedSlug && humanizedSlug !== urlSlug) {
      urlQueries.push(humanizedSlug);
    }

    for (const candidateQuery of urlQueries) {
      const markets = await searchMarkets(candidateQuery, 5);
      if (markets.length === 0) continue;

      const exactSlug = markets.find((market) => market.slug === urlSlug);
      return {
        slug: exactSlug?.slug || markets[0].slug || urlSlug,
        candidates: markets,
        matched: 'url',
      };
    }

    // URL slug not found in Gamma — still use it (DB may have data)
    return { slug: urlSlug, candidates: [], matched: 'url' };
  }

  // 2. Gamma API search with improved matching
  let candidates = await searchMarkets(query, 10);

  // 2.3 Cross-lingual fallback: fire in PARALLEL with key-term search
  // instead of sequentially (PF-M7). Saves one round-trip in the worst case.
  const translated = translateQuery(query);
  const needsTranslation = translated !== query;

  // 2.1 If no results, try removing punctuation and common words (fast local op)
  if (candidates.length === 0) {
    const simplifiedQuery = query
      .replace(/[.,!?;:'"]/g, '')
      .replace(/\b(will|the|a|an|and|or|but|in|on|at|to|for|of|with|by)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (simplifiedQuery && simplifiedQuery !== query) {
      candidates = await searchMarkets(simplifiedQuery, 10);
    }
  }

  // 2.2 If still no results, try key-terms and translation IN PARALLEL.
  if (candidates.length === 0) {
    const words = query.toLowerCase().split(/\s+/);
    const keyTerms = words.filter(word => word.length > 3 && !['will', 'the', 'and'].includes(word));
    const keyQuery = keyTerms.length > 0 ? keyTerms.slice(0, 5).join(' ') : null;

    // Fire key-term and translation searches in parallel — use the first success.
    const parallelSearches: Promise<typeof candidates>[] = [];
    if (keyQuery) parallelSearches.push(searchMarkets(keyQuery, 10));
    if (needsTranslation) parallelSearches.push(searchMarkets(translated, 10));

    if (parallelSearches.length > 0) {
      const settled = await Promise.allSettled(parallelSearches);
      for (const r of settled) {
        if (r.status === 'fulfilled' && r.value.length > 0) {
          candidates = r.value;
          break;
        }
      }
    }
  }

  if (candidates.length === 0) {
    return { slug: null, candidates: [], matched: 'none' };
  }

  // 3. Improved selection: consider both volume and title relevance.
  // Require a minimum relevance score — low scores mean the Gamma API returned
  // popular but irrelevant markets (e.g. "bitcoin" → "Will Ronaldo Cry?").
  const MIN_RELEVANCE_SCORE = 15;

  const queryLower = query.toLowerCase();
  let bestMatch: MarketMatch | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const titleLower = candidate.title.toLowerCase();
    let relevance = 0;

    // Calculate relevance score (0–60, without volume boost)
    if (titleLower === queryLower) {
      relevance = 60; // Exact match
    } else if (titleLower.includes(queryLower) || queryLower.includes(titleLower)) {
      relevance = 45; // Contains or is contained
    } else {
      // Calculate keyword overlap
      const queryWords = new Set(queryLower.split(/\s+/).filter(w => w.length > 2));
      const titleWords = new Set(titleLower.split(/\s+/).filter(w => w.length > 2));
      const overlap = [...queryWords].filter(word => titleWords.has(word)).length;
      const total = Math.max(queryWords.size, titleWords.size);
      relevance = (overlap / total) * 40;
    }

    // Add volume weight (up to 20 points) — only amplifies relevant matches
    const volumeWeight = Math.min((candidate.volume24h || 0) / 10000, 1) * 20;
    const score = relevance + volumeWeight;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  // If no candidate passes the relevance threshold, don't force a bad match
  if (!bestMatch || bestScore < MIN_RELEVANCE_SCORE) {
    return { slug: null, candidates, matched: 'none' };
  }

  return {
    slug: bestMatch.slug || query,
    candidates,
    matched: 'search',
  };
}
