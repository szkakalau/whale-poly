// services/landing/src/lib/vw-signals.ts

import { prisma } from '@/lib/prisma';

// —— Types ——

export interface VwMetricsRow {
  marketId: string;
  marketTitle: string;
  totalVolumeUsd: number;
  yesVolumeUsd: number;
  noVolumeUsd: number;
  yesVwPrice: number | null;
  noVwPrice: number | null;
  yesMarketPrice: number | null;
  vwDivergence: number | null;
  uai: number | null;
  vwVelocity5m: number | null;
  signalDirection: 'bullish' | 'bearish' | 'neutral' | null;
  signalStrength: number | null;
  status: string;
  computedAt: Date | null;
}

export interface VwSnapshotPoint {
  snapshotAt: Date;
  vwDivergence: number | null;
  yesMarketPrice: number | null;
  // Derived: VW_yes_share = Price_yes + divergence
}

export interface CrossSignal {
  marketId: string;
  marketTitle: string;
  vwDirection: string | null;
  vwDivergence: number | null;
  whaleDirection: 'bullish' | 'bearish' | 'neutral';
  confidenceLevel: 'high' | 'medium' | 'low';
}

// —— Queries ——

/** Get VW metrics list (sorted by volume descending; used for the page list). */
export async function getVwMetrics(
  sortBy: 'volume' | 'divergence' | 'strength' = 'volume',
  limit = 50
): Promise<VwMetricsRow[]> {
  const orderMap: Record<'volume' | 'divergence' | 'strength', string> = {
    volume: 'total_volume_usd DESC',
    divergence: 'ABS(vw_divergence) DESC',
    strength: 'signal_strength DESC NULLS LAST',
  };

  try {
    const rows = await prisma.$queryRawUnsafe<VwMetricsRow[]>(
      `SELECT
         vw.market_id AS "marketId",
         m.title AS "marketTitle",
         vw.total_volume_usd::float AS "totalVolumeUsd",
         vw.yes_volume_usd::float AS "yesVolumeUsd",
         vw.no_volume_usd::float AS "noVolumeUsd",
         vw.yes_vw_price::float AS "yesVwPrice",
         vw.no_vw_price::float AS "noVwPrice",
         vw.yes_market_price::float AS "yesMarketPrice",
         vw.vw_divergence::float AS "vwDivergence",
         vw.uai::float AS "uai",
         vw.vw_velocity_5m::float AS "vwVelocity5m",
         vw.signal_direction AS "signalDirection",
         vw.signal_strength AS "signalStrength",
         vw.status,
         vw.computed_at AS "computedAt"
       FROM market_vw_metrics vw
       JOIN markets m ON vw.market_id = m.id
       WHERE vw.status = 'active'
       ORDER BY ${orderMap[sortBy]}
       LIMIT ${limit}`
    );
    return rows;
  } catch {
    return [];
  }
}

/** Get snapshot data points for a single market's trend chart. */
export async function getVwSnapshots(
  marketId: string,
  hours = 24
): Promise<VwSnapshotPoint[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<VwSnapshotPoint[]>(
      `SELECT
         snapshot_at AS "snapshotAt",
         vw_divergence::float AS "vwDivergence",
         yes_market_price::float AS "yesMarketPrice"
       FROM market_vw_snapshots
       WHERE market_id = $1
         AND snapshot_at > NOW() - INTERVAL '${hours} hours'
       ORDER BY snapshot_at ASC`,
      marketId
    );
    return rows;
  } catch {
    return [];
  }
}

/** Calculate Whale x VW cross signal. */
export async function getCrossSignals(
  marketId: string
): Promise<CrossSignal | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `WITH whale_dir AS (
         SELECT
           market_id,
           CASE
             WHEN SUM(CASE WHEN wt.side = 'BUY' THEN wt.size * wt.price ELSE 0 END)
                  > SUM(CASE WHEN wt.side = 'SELL' THEN wt.size * wt.price ELSE 0 END)
             THEN 'bullish'
             ELSE 'bearish'
           END AS whale_direction
         FROM whale_trade_history wt
         WHERE wt.market_id = $1
           AND wt.timestamp > NOW() - INTERVAL '24 hours'
         GROUP BY wt.market_id
       )
       SELECT
         vw.market_id AS "marketId",
         m.title AS "marketTitle",
         vw.signal_direction AS "vwDirection",
         vw.vw_divergence::float AS "vwDivergence",
         wd.whale_direction AS "whaleDirection"
       FROM market_vw_metrics vw
       JOIN markets m ON vw.market_id = m.id
       LEFT JOIN whale_dir wd ON vw.market_id = wd.market_id
       WHERE vw.market_id = $1`,
      marketId
    );

    if (rows.length === 0) return null;

    const row = rows[0];
    const confidence = deriveConfidence(row.vwDirection, row.whaleDirection);

    return {
      marketId: row.marketId,
      marketTitle: row.marketTitle,
      vwDirection: row.vwDirection,
      vwDivergence: row.vwDivergence,
      whaleDirection: row.whaleDirection || 'neutral',
      confidenceLevel: confidence,
    };
  } catch {
    return null;
  }
}

// —— Client-side fetch wrappers (call API route instead of Prisma directly) ——

/** Fetch VW metrics list via the /api/vw API route. Safe for client components. */
export async function getVwMetricsApi(
  sortBy: 'volume' | 'divergence' | 'strength' = 'volume',
  limit = 50
): Promise<VwMetricsRow[]> {
  try {
    const res = await fetch(
      `/api/vw?action=metrics&sortBy=${sortBy}&limit=${limit}`
    );
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

/** Fetch VW snapshots via the /api/vw API route. Safe for client components. */
export async function getVwSnapshotsApi(
  marketId: string,
  hours = 24
): Promise<VwSnapshotPoint[]> {
  try {
    const res = await fetch(
      `/api/vw?action=snapshots&marketId=${encodeURIComponent(marketId)}&hours=${hours}`
    );
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

/** Fetch cross signal via the /api/vw API route. Safe for client components. */
export async function getCrossSignalsApi(
  marketId: string
): Promise<CrossSignal | null> {
  try {
    const res = await fetch(
      `/api/vw?action=cross&marketId=${encodeURIComponent(marketId)}`
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch {
    return null;
  }
}

// —— Helpers ——

function deriveConfidence(
  vwDir: string | null,
  whaleDir: string | null
): 'high' | 'medium' | 'low' {
  if (!vwDir || !whaleDir) return 'medium';
  // Same direction = high confidence, opposite = low, otherwise medium.
  if (vwDir === whaleDir) return 'high';
  if (
    (vwDir === 'bullish' && whaleDir === 'bearish') ||
    (vwDir === 'bearish' && whaleDir === 'bullish')
  )
    return 'low';
  return 'medium';
}
