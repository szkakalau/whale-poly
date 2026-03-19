import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';

type LiveSignal = {
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
  whale_score?: unknown;
  recent_trades?: unknown;
};

async function fetchJsonWithTimeout<T>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<T | null> {
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

const loadLiveSignals = unstable_cache(
  async (): Promise<LiveSignal[]> => {
    try {
      const wallets = await prisma.$queryRawUnsafe<{ wallet_address: string }[]>(
        `
        SELECT wallet_address
        FROM whale_profiles
        ORDER BY total_volume DESC NULLS LAST
        LIMIT 12
        `,
      );

      const base = WHALE_ENGINE_BASE.replace(/\/$/, '');

      const results = await Promise.allSettled(
        wallets.map(async (row) => {
          const wallet = row.wallet_address;
          const payload = await fetchJsonWithTimeout<WhaleEngineProfile>(
            `${base}/whales/${encodeURIComponent(wallet)}`,
            { cache: 'force-cache', next: { revalidate: 60 } },
            2000,
          );
          if (!payload) return null;

          const recent = Array.isArray(payload.recent_trades)
            ? (payload.recent_trades as WhaleEngineTrade[])
            : [];
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
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        .slice(0, 10);
    } catch {
      return [];
    }
  },
  ['blog-live-signals'],
  { revalidate: 60 },
);

export async function GET() {
  const signals = await loadLiveSignals();
  const resp = NextResponse.json({ signals, source: 'whale_profiles+whale_engine', refreshedAt: new Date().toISOString() });
  resp.headers.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
  return resp;
}

