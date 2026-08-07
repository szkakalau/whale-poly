/**
 * Market Correlation Analysis
 *
 * Identifies related markets by computing Pearson correlation on their
 * VW divergence time series. Market categories come from Polymarket Gamma tags.
 *
 * Elite-tier feature — gated via plans.ts.
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { clamp } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────

export type MarketCorrelation = {
  marketA: { slug: string; title: string };
  marketB: { slug: string; title: string };
  pearsonR: number;          // -1 to 1
  overlapCount: number;      // how many shared snapshot timestamps
  commonCategory: string | null;
  significance: 'high' | 'medium' | 'low';
};

export type CategoryFlowMap = {
  category: string;
  totalVolumeUsd: number;
  bullishCount: number;
  bearishCount: number;
  dominantDirection: 'bullish' | 'bearish' | 'neutral';
  marketCount: number;
};

// ── Helpers ────────────────────────────────────────────

/**
 * Pearson correlation coefficient.
 * Requires two arrays of equal length.
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;

  // Slice to n before computing stats — means must match the iteration window.
  const xs = x.slice(0, n);
  const ys = y.slice(0, n);

  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;

  let cov = 0;
  let varX = 0;
  let varY = 0;

  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  const denom = Math.sqrt(varX * varY);
  if (denom < 1e-12) return 0;
  return clamp(cov / denom, -1, 1);
}

// ── Snapshot query ─────────────────────────────────────

type SnapshotRow = {
  market_id: string;
  title: string | null;
  vw_divergence: number | null;
  snapshot_at: Date;
};

/**
 * Load VW snapshot data for all active markets in the given time window.
 */
async function loadSnapshotData(hours: number): Promise<Map<string, { title: string; points: { time: number; div: number }[] }>> {
  try {
    const rows = await prisma.$queryRaw<SnapshotRow[]>(
      Prisma.sql`
        SELECT
          s.market_id,
          m.title,
          s.vw_divergence::float AS vw_divergence,
          s.snapshot_at
        FROM market_vw_snapshots s
        JOIN markets m ON s.market_id = m.id
        WHERE s.snapshot_at > NOW() - INTERVAL '1 hour' * ${hours}
          AND s.vw_divergence IS NOT NULL
        ORDER BY s.market_id, s.snapshot_at ASC
      `
    );

    const marketMap = new Map<string, { title: string; points: { time: number; div: number }[] }>();
    for (const row of rows) {
      const mid = row.market_id;
      if (!marketMap.has(mid)) {
        marketMap.set(mid, { title: row.title || mid, points: [] });
      }
      const entry = marketMap.get(mid)!;
      if (row.vw_divergence != null) {
        entry.points.push({
          time: new Date(row.snapshot_at).getTime(),
          div: row.vw_divergence,
        });
      }
    }
    return marketMap;
  } catch (err) {
    console.error('loadSnapshotData: query failed', err);
    return new Map();
  }
}

// ── Core correlation ───────────────────────────────────

/**
 * Compute pairwise market correlations based on VW divergence time series.
 *
 * Steps:
 * 1. Load snapshot data for all active markets
 * 2. For each market pair, align snapshots by timestamp (bucket to nearest 5min)
 * 3. Compute Pearson r on aligned divergence values
 * 4. Filter by significance and minimum overlap
 *
 * @param hours - lookback window in hours (default 48)
 * @param minOverlap - minimum shared snapshots required (default 5)
 * @param minAbsR - minimum absolute correlation to report (default 0.3)
 */
export async function computeMarketCorrelations(
  hours = 48,
  minOverlap = 5,
  minAbsR = 0.3,
): Promise<MarketCorrelation[]> {
  const marketMap = await loadSnapshotData(hours);
  const marketIds = Array.from(marketMap.keys());

  if (marketIds.length < 2) return [];

  const results: MarketCorrelation[] = [];

  // Pairwise comparison
  for (let i = 0; i < marketIds.length; i++) {
    for (let j = i + 1; j < marketIds.length; j++) {
      const a = marketIds[i];
      const b = marketIds[j];
      const dataA = marketMap.get(a)!;
      const dataB = marketMap.get(b)!;

      // Align by time buckets (5-minute granularity)
      const bucketMs = 5 * 60 * 1000;
      const divA: number[] = [];
      const divB: number[] = [];

      let ai = 0;
      let bi = 0;

      while (ai < dataA.points.length && bi < dataB.points.length) {
        const timeA = dataA.points[ai].time;
        const timeB = dataB.points[bi].time;
        const diff = Math.abs(timeA - timeB);

        if (diff <= bucketMs) {
          divA.push(dataA.points[ai].div);
          divB.push(dataB.points[bi].div);
          ai++;
          bi++;
        } else if (timeA < timeB) {
          ai++;
        } else {
          bi++;
        }
      }

      if (divA.length < minOverlap) continue;

      const r = pearsonCorrelation(divA, divB);
      if (Math.abs(r) < minAbsR) continue;

      results.push({
        marketA: { slug: a, title: dataA.title },
        marketB: { slug: b, title: dataB.title },
        pearsonR: Math.round(r * 1000) / 1000,
        overlapCount: divA.length,
        commonCategory: null, // populated by caller with Gamma tags
        significance: Math.abs(r) > 0.7 ? 'high' : Math.abs(r) > 0.5 ? 'medium' : 'low',
      });
    }
  }

  // Sort by |r| descending
  results.sort((a, b) => Math.abs(b.pearsonR) - Math.abs(a.pearsonR));

  return results.slice(0, 50); // return top 50
}

// ── Category Flow ──────────────────────────────────────

type CategoryMarketRow = {
  market_id: string;
  signal_direction: string | null;
  total_volume_usd: number | null;
};

/**
 * Compute fund flow by market category using VW signal directions.
 */
export async function computeCategoryFlows(): Promise<CategoryFlowMap[]> {
  try {
    const rows = await prisma.$queryRaw<CategoryMarketRow[]>(
      Prisma.sql`
        SELECT
          vw.market_id,
          vw.signal_direction,
          vw.total_volume_usd::float AS total_volume_usd
        FROM market_vw_metrics vw
        WHERE vw.status = 'active'
          AND vw.total_volume_usd > 1000
      `
    );

    // Group by category (simplified — uses market_id prefix as proxy)
    // In production, this would join with market_categories or Gamma tags
    const categoryMap = new Map<string, {
      totalVolumeUsd: number;
      bullishCount: number;
      bearishCount: number;
      markets: Set<string>;
    }>();

    for (const row of rows) {
      // Use market_id prefix as rough category (e.g. "politics-xxx")
      const prefix = (row.market_id || '').split('-')[0] || 'other';
      if (!categoryMap.has(prefix)) {
        categoryMap.set(prefix, {
          totalVolumeUsd: 0,
          bullishCount: 0,
          bearishCount: 0,
          markets: new Set(),
        });
      }
      const cat = categoryMap.get(prefix)!;
      cat.totalVolumeUsd += Number(row.total_volume_usd) || 0;
      cat.markets.add(row.market_id);

      if (row.signal_direction === 'bullish') cat.bullishCount++;
      else if (row.signal_direction === 'bearish') cat.bearishCount++;
    }

    return Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        totalVolumeUsd: Math.round(data.totalVolumeUsd),
        bullishCount: data.bullishCount,
        bearishCount: data.bearishCount,
        dominantDirection: data.bullishCount > data.bearishCount ? 'bullish' as const
          : data.bearishCount > data.bullishCount ? 'bearish' as const
          : 'neutral' as const,
        marketCount: data.markets.size,
      }))
      .sort((a, b) => b.totalVolumeUsd - a.totalVolumeUsd);

  } catch (err) {
    console.error('computeCategoryFlows: query failed', err);
    return [];
  }
}
