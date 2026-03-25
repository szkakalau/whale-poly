import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';

export type LiveSignal = {
  id: string;
  occurredAt: string;
  walletMasked: string;
  market: string;
  side: 'BUY' | 'SELL' | 'UNKNOWN';
  sizeUsd: number;
  whaleScore?: number;
  href?: string;
};

const WHALE_ENGINE_BASE =
  process.env.NEXT_PUBLIC_WHALE_ENGINE_API_BASE_URL || 'https://whale-engine-api.onrender.com';

function safeNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function shortenWallet(addr: string): string {
  const v = (addr || '').trim();
  if (v.length <= 10) return v;
  return `${v.slice(0, 6)}…${v.slice(-4)}`;
}

type WhaleEngineTrade = {
  time?: unknown;
  created_at?: unknown;
  market?: unknown;
  market_title?: unknown;
  side?: unknown;
  size?: unknown;
  trade_usd?: unknown;
  whale_score?: unknown;
};

type WhaleEngineProfile = {
  wallet?: unknown;
  whale_score?: unknown;
  recent_trades?: unknown;
};

async function fetchJsonWithTimeout<T>(url: string, init: RequestInit, timeoutMs: number): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json().catch(() => null)) as T | null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Public Polymarket leaderboard — used when DB has no whales or whale-engine returns no trades for profile wallets. */
async function fetchPolymarketVolumeLeaderWallets(limit: number): Promise<string[]> {
  const url = `https://data-api.polymarket.com/v1/leaderboard?category=OVERALL&timePeriod=MONTH&orderBy=VOL&limit=${limit}`;
  const res = await fetch(url, { next: { revalidate: 120 } }).catch(() => null);
  if (!res?.ok) return [];
  const data = (await res.json().catch(() => null)) as unknown;
  if (!Array.isArray(data)) return [];
  const out: string[] = [];
  for (const row of data) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const w = String(r.proxyWallet ?? r.wallet ?? '').trim();
    if (w) out.push(w);
  }
  return out.slice(0, limit);
}

async function getWalletAddressesFromProfiles(): Promise<string[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ wallet_address: string }[]>(
      `
      SELECT wallet_address
      FROM whale_profiles
      ORDER BY total_volume DESC NULLS LAST
      LIMIT 12
      `,
    );
    return (rows || []).map((r) => String(r.wallet_address).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

async function buildSignalsFromWallets(wallets: string[]): Promise<LiveSignal[]> {
  const base = WHALE_ENGINE_BASE.replace(/\/$/, '');
  if (wallets.length === 0) return [];

  const results = await Promise.allSettled(
    wallets.map(async (wallet) => {
      const payload = await fetchJsonWithTimeout<WhaleEngineProfile>(
        `${base}/whales/${encodeURIComponent(wallet)}`,
        { cache: 'no-store' },
        8000,
      );
      if (!payload) return null;

      const recent = Array.isArray(payload.recent_trades) ? (payload.recent_trades as WhaleEngineTrade[]) : [];
      const last = recent.length > 0 ? recent[0] : null;
      if (!last) return null;

      const occurredAt = safeString(last.time ?? last.created_at, '');
      const market = safeString(last.market ?? last.market_title, '');
      const sideRaw = safeString(last.side, '').toUpperCase();
      const side = sideRaw === 'BUY' ? 'BUY' : sideRaw === 'SELL' ? 'SELL' : 'UNKNOWN';
      const sizeUsd = safeNumber(last.size ?? last.trade_usd, 0);
      const whaleScore = safeNumber(last.whale_score ?? payload.whale_score, NaN);
      if (!occurredAt || !market || !Number.isFinite(sizeUsd) || sizeUsd <= 0) return null;

      return {
        id: `${wallet}-${occurredAt}`,
        occurredAt,
        walletMasked: shortenWallet(wallet),
        market,
        side,
        sizeUsd,
        whaleScore: Number.isFinite(whaleScore) ? whaleScore : undefined,
        href: `/whales/${encodeURIComponent(wallet)}`,
      } satisfies LiveSignal;
    }),
  );

  return results
    .flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value] : []))
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}

/**
 * Same Postgres as the ingest pipeline — works when public whale-engine HTTP has no rows
 * for leaderboard wallets (not ingested there) or API is slow/unreachable.
 */
async function loadSignalsFromWhaleTradesJoin(): Promise<LiveSignal[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<
      {
        wallet_address: string;
        created_at: Date;
        market_title: string | null;
        side: string | null;
        trade_usd: unknown;
        whale_score: unknown;
      }[]
    >(
      `
      SELECT
        wt.wallet_address,
        wt.created_at,
        COALESCE(NULLIF(TRIM(tr.market_title), ''), wt.market_id) AS market_title,
        tr.side,
        (tr.amount::numeric * tr.price::numeric) AS trade_usd,
        wt.whale_score
      FROM whale_trades wt
      INNER JOIN trades_raw tr ON tr.trade_id = wt.trade_id
      ORDER BY wt.created_at DESC NULLS LAST
      LIMIT 24
      `,
    );

    const out: LiveSignal[] = [];
    for (const row of rows) {
      const sizeUsd = safeNumber(row.trade_usd, 0);
      const sideRaw = safeString(row.side, '').toUpperCase();
      const side = sideRaw === 'BUY' ? 'BUY' : sideRaw === 'SELL' ? 'SELL' : 'UNKNOWN';
      const market = safeString(row.market_title, '').trim() || 'Polymarket market';
      const wallet = safeString(row.wallet_address, '').trim();
      const occurredAt =
        row.created_at instanceof Date ? row.created_at.toISOString() : safeString(row.created_at, '');
      if (!occurredAt || !wallet || !Number.isFinite(sizeUsd) || sizeUsd <= 0) continue;
      const ws = safeNumber(row.whale_score, NaN);
      out.push({
        id: `wt-${wallet}-${occurredAt}`,
        occurredAt,
        walletMasked: shortenWallet(wallet),
        market,
        side,
        sizeUsd,
        whaleScore: Number.isFinite(ws) ? ws : undefined,
        href: `/whales/${encodeURIComponent(wallet)}`,
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function loadLiveSignalsUncached(): Promise<LiveSignal[]> {
  try {
    const primary = await getWalletAddressesFromProfiles();
    let signals = await buildSignalsFromWallets(primary);

    if (signals.length === 0) {
      const fallback = await fetchPolymarketVolumeLeaderWallets(20);
      const merged = [...new Set([...primary, ...fallback])];
      signals = await buildSignalsFromWallets(merged.slice(0, 24));
    }

    if (signals.length === 0) {
      signals = await loadSignalsFromWhaleTradesJoin();
    }

    return signals.slice(0, 10);
  } catch {
    return [];
  }
}

/** Bump key when loader logic changes (avoids long-lived empty cache). */
export const loadLiveSignals = unstable_cache(loadLiveSignalsUncached, ['live-signals-feed-v3'], {
  revalidate: 60,
});
