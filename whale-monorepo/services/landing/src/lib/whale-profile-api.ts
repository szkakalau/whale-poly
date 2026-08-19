/**
 * Public whale profile + leaderboard data access.
 *
 * Reads from the whale_engine service. In production the service is mounted
 * behind the same origin (`https://sightwhale.onrender.com/whale`), while the
 * landing app reaches it through NEXT_PUBLIC_WHALE_ENGINE_API_BASE_URL (same
 * convention as src/app/api/vw/route.ts).
 */

const WHALE_ENGINE_BASE = (
  process.env.NEXT_PUBLIC_WHALE_ENGINE_API_BASE_URL || 'https://whale-engine-api.onrender.com'
).replace(/\/$/, '');

const FETCH_TIMEOUT_MS = 10_000;

// ── Types ────────────────────────────────────────────────────────────────────

export type WhaleScoreBreakdown = {
  performance: number;
  consistency: number;
  timing: number;
  risk: number;
  impact: number;
};

export type TopMarket = {
  market: string;
  market_id: string | null;
  market_title: string | null;
  trades: number;
  volume: number;
  pnl: number;
};

export type RecentTrade = {
  whale_trade_id?: number | null;
  trade_id?: string | null;
  market_id?: string | null;
  market_title?: string | null;
  side?: string | null;
  amount?: number | null;
  price?: number | null;
  trade_usd?: number | null;
  whale_score?: number | null;
  created_at?: string | null;
  time?: string | null;
  market?: string | null;
  action?: string | null;
  size?: number | null;
};

export type WhaleProfile = {
  wallet: string;
  display_name: string;
  whale_score: number;
  whale_score_breakdown: WhaleScoreBreakdown | null;
  total_volume: number;
  total_trades: number;
  win_rate: number;
  realized_pnl: number;
  stats?: {
    total_volume: number;
    total_trades: number;
    win_rate: number;
    realized_pnl: number;
  } | null;
  performance_30d?: {
    pnl: number;
    win_rate: number;
    volume: number;
  } | null;
  top_markets: TopMarket[];
  recent_trades: RecentTrade[];
  behavior?: {
    common_action: string;
    avg_trade_size: number;
    side_bias: string;
  } | null;
  /** Present when the upstream rate limiter rejected the request. */
  detail?: string;
};

export type LeaderboardEntry = {
  wallet: string;
  display_name: string;
  whale_score: number;
  volume_30d: number;
  pnl_30d: number;
  /** null when the wallet has no settled trades in the 30d window. */
  win_rate_30d: number | null;
};

// ── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as T;
    return json;
  } catch {
    return null;
  }
}

/**
 * Fetch a single whale's public profile.
 * Returns `null` on network error, timeout, or non-2xx upstream response so
 * callers can render a graceful "data unavailable" state instead of crashing.
 */
export async function getWhaleProfile(wallet: string): Promise<WhaleProfile | null> {
  const safeWallet = (wallet || '').trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(safeWallet)) return null;
  return fetchJson<WhaleProfile>(
    `${WHALE_ENGINE_BASE}/whales/${encodeURIComponent(safeWallet)}`,
  );
}

/**
 * Fetch the public whale leaderboard.
 * Returns `null` on failure. The upstream response is `{ whales: [...] }`.
 */
export async function getWhalesLeaderboard(limit = 50): Promise<LeaderboardEntry[] | null> {
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 50) : 50;
  const data = await fetchJson<{ whales?: LeaderboardEntry[] }>(
    `${WHALE_ENGINE_BASE}/whales/leaderboard?limit=${safeLimit}`,
  );
  if (!data || !Array.isArray(data.whales)) return null;
  return data.whales;
}

// ── Formatting helpers (shared by profile + leaderboard pages) ───────────────

/** Shorten a wallet address for compact display: `0x94f1…4c7a`. */
export function shortWallet(addr: string | null | undefined): string {
  const v = (addr || '').trim();
  if (!v) return '—';
  if (v.length <= 12) return v;
  return `${v.slice(0, 6)}…${v.slice(-4)}`;
}

/** Integer with thousands separators; `—` for null/invalid. */
export function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return Math.round(value).toLocaleString('en-US');
}

/** Unsigned USD with thousands separators; `—` for null/invalid. */
export function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

/** Signed USD for PnL-style values (uses U+2212 minus for negatives). */
export function formatSignedUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}$${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

/** Fraction (0–1) → percentage string with one decimal. */
export function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

/** Fixed-decimal truncation for prices / ratios. */
export function formatDecimal(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}
