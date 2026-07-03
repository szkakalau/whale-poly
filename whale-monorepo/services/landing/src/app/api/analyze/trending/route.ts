/**
 * GET /api/analyze/trending
 *
 * Returns conviction analysis for the top N trending Polymarket markets.
 * Results are cached for 5 minutes. Used by the /analyze page empty state
 * and the trending feed (Phase 3 E6).
 */
import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { analyzeMarket } from '@/lib/analysis-engine';

const GAMMA_MARKETS_URL = 'https://gamma-api.polymarket.com/markets';
const TOP_N = 10;

type TrendingEntry = {
  slug: string;
  title: string;
  volume24h: number;
  direction: string;
  confidenceScore: number;
  confidenceLevel: string;
  whaleTradeCount: number;
};

async function fetchTrendingUncached(): Promise<TrendingEntry[]> {
  // Fetch top open markets from Gamma by 24h volume
  let markets: { slug: string; title: string; volume: number }[] = [];
  try {
    const url = new URL(GAMMA_MARKETS_URL);
    url.searchParams.set('limit', String(TOP_N * 2)); // fetch extra for filtering
    url.searchParams.set('order', 'volume24hr');
    url.searchParams.set('ascending', 'false');
    url.searchParams.set('closed', 'false');

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
    });

    const data = (await res.json().catch(() => [])) as unknown;
    if (Array.isArray(data)) {
      for (const row of data) {
        if (!row || typeof row !== 'object') continue;
        const r = row as Record<string, unknown>;
        const slug = String(r.slug ?? '').trim();
        const title = String(r.title ?? r.question ?? '').trim();
        const volume = Number(r.volume24hr ?? r.volume ?? 0);
        if (slug && title && Number.isFinite(volume)) {
          markets.push({ slug, title, volume });
        }
      }
    }
  } catch {
    // Gamma unavailable — return empty, client handles gracefully
  }

  // Dedupe by slug
  const seen = new Set<string>();
  markets = markets.filter((m) => {
    if (seen.has(m.slug)) return false;
    seen.add(m.slug);
    return true;
  }).slice(0, TOP_N);

  // Score each market IN PARALLEL instead of sequentially (PF-C3).
  // With 10 markets each ~800ms, serial = 8s, parallel = ~800ms — 10x faster.
  const settled = await Promise.allSettled(
    markets.map(async (m): Promise<TrendingEntry | null> => {
      try {
        const analysis = await analyzeMarket(m.slug);
        return {
          slug: m.slug,
          title: m.title,
          volume24h: m.volume,
          direction: analysis.direction,
          confidenceScore: analysis.confidenceScore,
          confidenceLevel: analysis.confidenceLevel,
          whaleTradeCount: analysis.whaleTradeCount,
        };
      } catch {
        return null;
      }
    })
  );
  const results: TrendingEntry[] = [];
  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value !== null) {
      results.push(r.value);
    }
  }

  // Sort: markets with whale activity first, then by volume
  results.sort((a, b) => {
    const aActive = a.whaleTradeCount > 0 ? 1 : 0;
    const bActive = b.whaleTradeCount > 0 ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;
    return b.volume24h - a.volume24h;
  });

  return results;
}

export const fetchTrending = unstable_cache(fetchTrendingUncached, ['trending-feed-v2'], {
  revalidate: 300, // 5 minutes
});

export async function GET() {
  try {
    const results = await fetchTrending();
    return NextResponse.json({ markets: results });
  } catch {
    return NextResponse.json({ markets: [] });
  }
}
