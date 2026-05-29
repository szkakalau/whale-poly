/**
 * Market category resolver — Phase 0.5 infrastructure.
 *
 * Maps Polymarket markets to categories (Politics, Crypto, Sports, etc.)
 * using Gamma API tags. Caches results for 1 hour.
 *
 * Also provides per-category wallet performance stats for the evidence chain.
 */
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';

export type CategoryTag = string;

// Top-level categories we care about
const CATEGORY_WHITELIST = new Set([
  'politics', 'elections', 'crypto', 'sports', 'economics',
  'macro', 'finance', 'technology', 'entertainment', 'science',
  'world', 'us-politics', 'regulation', 'pop-culture', 'business',
]);

/** Normalize Gamma tags to a primary category */
function normalizeCategory(tags: string[]): string | null {
  for (const raw of tags) {
    const t = raw.toLowerCase().trim().replace(/[-\s]+/g, '-');
    if (CATEGORY_WHITELIST.has(t)) return t;
    // Also match partials
    for (const cat of CATEGORY_WHITELIST) {
      if (t.includes(cat) || cat.includes(t)) return cat;
    }
  }
  return tags.length > 0 ? tags[0].toLowerCase().trim() : null;
}

async function fetchMarketCategoriesUncached(marketSlug: string): Promise<CategoryTag[]> {
  try {
    const url = new URL('https://gamma-api.polymarket.com/markets');
    url.searchParams.set('slug', marketSlug);
    url.searchParams.set('limit', '1');

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as unknown;
    if (!Array.isArray(data) || data.length === 0) return [];

    const row = data[0] as Record<string, unknown>;
    const tags: string[] = Array.isArray(row.tags) ? row.tags.map(String) : [];
    const cat = normalizeCategory(tags);
    return cat ? [cat] : [];
  } catch {
    return [];
  }
}

export const fetchMarketCategories = unstable_cache(
  fetchMarketCategoriesUncached,
  ['market-categories-v1'],
  { revalidate: 3600 },
);

/**
 * Batch-fetch categories for multiple markets.
 */
export async function batchMarketCategories(slugs: string[]): Promise<Map<string, CategoryTag[]>> {
  const map = new Map<string, CategoryTag[]>();
  for (const slug of slugs) {
    const cats = await fetchMarketCategories(slug);
    if (cats.length > 0) map.set(slug, cats);
  }
  return map;
}

// ── Per-Category Wallet Stats ──────────────────────────

export type WalletCategoryStats = {
  walletAddress: string;
  category: string;
  totalTrades: number;
  wins: number;
  winRate: number;
  totalVolumeUsd: number;
  avgRoi?: number;
};

/**
 * Compute per-category performance for a given wallet using the trade history.
 * Joins whale_trades → trades_raw → Gamma API to get categories.
 *
 * For prototype: uses a simplified approach — queries recent trades and
 * cross-references with Gamma categories.
 */
export async function getWalletCategoryStats(
  walletAddress: string,
  categories: string[],
): Promise<WalletCategoryStats[]> {
  if (categories.length === 0) return [];

  try {
    // Get recent trades for this wallet
    const trades = await prisma.$queryRawUnsafe<
      { market_id: string; side: string; trade_usd: number }[]
    >(
      `
      SELECT
        wt.market_id,
        tr.side,
        (tr.amount::numeric * tr.price::numeric) AS trade_usd
      FROM whale_trades wt
      INNER JOIN trades_raw tr ON tr.trade_id = wt.trade_id
      WHERE wt.wallet_address = $1
      ORDER BY wt.created_at DESC
      LIMIT 500
      `,
      walletAddress,
    );

    if (trades.length === 0) return [];

    // Get unique market IDs and resolve their categories
    const marketIds = [...new Set(trades.map((t) => t.market_id).filter(Boolean))];
    const marketCats = await batchMarketCategories(marketIds);

    // Aggregate by category
    const byCategory = new Map<string, { total: number; wins: number; volume: number }>();
    for (const t of trades) {
      if (!t.market_id) continue;
      const cats = marketCats.get(t.market_id) || [];
      if (cats.length === 0) continue;

      for (const cat of cats) {
        if (!categories.includes(cat)) continue;
        const entry = byCategory.get(cat) || { total: 0, wins: 0, volume: 0 };
        entry.total++;
        entry.volume += Number(t.trade_usd) || 0;
        // BUY on YES outcome = win proxy (simplified — real system uses settlement data)
        if (t.side === 'BUY') entry.wins++;
        byCategory.set(cat, entry);
      }
    }

    const results: WalletCategoryStats[] = [];
    for (const [category, stats] of byCategory) {
      results.push({
        walletAddress,
        category,
        totalTrades: stats.total,
        wins: stats.wins,
        winRate: stats.total > 0 ? stats.wins / stats.total : 0,
        totalVolumeUsd: stats.volume,
      });
    }

    return results.sort((a, b) => b.totalTrades - a.totalTrades);
  } catch {
    return [];
  }
}
