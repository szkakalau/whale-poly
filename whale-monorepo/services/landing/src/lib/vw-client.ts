// Client-safe VW helpers — no Prisma imports, safe for 'use client' components

// —— Types (mirrored from vw-signals.ts) ——

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
}

export interface CrossSignal {
  marketId: string;
  marketTitle: string;
  vwDirection: string | null;
  vwDivergence: number | null;
  whaleDirection: 'bullish' | 'bearish' | 'neutral';
  confidenceLevel: 'high' | 'medium' | 'low';
}

// —— Fetch wrappers ——

export async function getVwMetricsApi(
  sortBy: 'volume' | 'divergence' | 'strength' = 'volume',
  limit = 50
): Promise<VwMetricsRow[]> {
  const res = await fetch(
    `/api/vw?action=metrics&sortBy=${sortBy}&limit=${limit}`
  );
  if (!res.ok) return [];
  const json = await res.json();
  return json.data || [];
}

export async function getVwSnapshotsApi(
  marketId: string,
  hours = 24
): Promise<VwSnapshotPoint[]> {
  const res = await fetch(
    `/api/vw?action=snapshots&marketId=${encodeURIComponent(marketId)}&hours=${hours}`
  );
  if (!res.ok) return [];
  const json = await res.json();
  return json.data || [];
}

export async function getCrossSignalsApi(
  marketId: string
): Promise<CrossSignal | null> {
  const res = await fetch(
    `/api/vw?action=cross&marketId=${encodeURIComponent(marketId)}`
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json.data || null;
}
