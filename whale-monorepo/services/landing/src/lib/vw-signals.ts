// services/landing/src/lib/vw-signals.ts
// Server-side Prisma queries for VW metrics.
// Types and client-safe fetch wrappers live in vw-client.ts.

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type { VwMetricsRow, VwSnapshotPoint, CrossSignal } from '@/lib/vw-client';

// Re-export types for convenience (single import for server components)
export type { VwMetricsRow, VwSnapshotPoint, CrossSignal };

// —— Queries ——

/** Get VW metrics list. */
export async function getVwMetrics(
  sortBy: 'volume' | 'divergence' | 'strength' = 'volume',
  limit = 50
): Promise<VwMetricsRow[]> {
  const orderClause = {
    volume: Prisma.sql`total_volume_usd DESC`,
    divergence: Prisma.sql`ABS(vw_divergence) DESC`,
    strength: Prisma.sql`signal_strength DESC NULLS LAST`,
  }[sortBy];

  const rows = await prisma.$queryRaw<VwMetricsRow[]>(
    Prisma.sql`SELECT
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
    ORDER BY ${orderClause}
    LIMIT ${limit}`
  );
  return rows || [];
}

/** Get snapshot data points for a single market's trend chart. */
export async function getVwSnapshots(
  marketId: string,
  hours = 24
): Promise<VwSnapshotPoint[]> {
  try {
    const rows = await prisma.$queryRaw<VwSnapshotPoint[]>(
      Prisma.sql`SELECT
        snapshot_at AS "snapshotAt",
        vw_divergence::float AS "vwDivergence",
        yes_market_price::float AS "yesMarketPrice"
      FROM market_vw_snapshots
      WHERE market_id = ${marketId}
        AND snapshot_at > NOW() - INTERVAL '1 hour' * ${hours}
      ORDER BY snapshot_at ASC`
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
    const rows = await prisma.$queryRaw<any[]>(
      Prisma.sql`WITH whale_dir AS (
        SELECT
          market_id,
          CASE
            WHEN SUM(CASE WHEN wt.side = 'BUY' THEN wt.size * wt.price ELSE 0 END)
                 > SUM(CASE WHEN wt.side = 'SELL' THEN wt.size * wt.price ELSE 0 END)
            THEN 'bullish'
            ELSE 'bearish'
          END AS whale_direction
        FROM whale_trade_history wt
        WHERE wt.market_id = ${marketId}
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
      WHERE vw.market_id = ${marketId}`
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
