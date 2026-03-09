import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { unstable_cache } from 'next/cache';

const ALLOWED_ORDER_BY = new Set(['PNL', 'VOL', 'ROI']);
const ALLOWED_TIME = new Set(['DAY', 'WEEK', 'MONTH', 'ALL']);
const ALLOWED_CATEGORY = new Set([
  'OVERALL',
  'POLITICS',
  'SPORTS',
  'CRYPTO',
  'CULTURE',
  'MENTIONS',
  'WEATHER',
  'ECONOMICS',
  'TECH',
  'FINANCE',
]);

type UpstreamLeaderboardRow = {
  proxyWallet?: unknown;
  wallet?: unknown;
  pnl?: unknown;
  profit?: unknown;
  vol?: unknown;
  volume?: unknown;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params = searchParams;
  const orderBy = (params.get('orderBy') || 'PNL').toUpperCase();
  const timePeriod = (params.get('timePeriod') || 'MONTH').toUpperCase();
  const category = (params.get('category') || 'OVERALL').toUpperCase();
  const limit = Math.min(Math.max(Number(params.get('limit') || 25), 1), 50);

  const safeOrderBy = ALLOWED_ORDER_BY.has(orderBy) ? orderBy : 'PNL';
  const safeTime = ALLOWED_TIME.has(timePeriod) ? timePeriod : 'MONTH';
  const safeCategory = ALLOWED_CATEGORY.has(category) ? category : 'OVERALL';

  const orderColumn =
    safeOrderBy === 'ROI' ? 'roi' : safeOrderBy === 'VOL' ? 'total_volume' : 'total_pnl';

  if (safeCategory !== 'OVERALL' || safeTime !== 'MONTH') {
    const upstreamUrl = new URL('https://data-api.polymarket.com/v1/leaderboard');
    upstreamUrl.searchParams.set('category', safeCategory);
    upstreamUrl.searchParams.set('timePeriod', safeTime);
    upstreamUrl.searchParams.set('orderBy', safeOrderBy);
    upstreamUrl.searchParams.set('limit', String(limit));

    const fetchUpstream = unstable_cache(
      async (url: string) => {
        const res = await fetch(url, {
          cache: 'force-cache',
          next: { revalidate: 30 },
        }).catch(() => null);
        if (!res || !res.ok) return null;
        const data = await res.json().catch(() => []);
        return Array.isArray(data) ? data : [];
      },
      ['polymarket-leaderboard-upstream', safeCategory, safeTime, safeOrderBy, String(limit)],
      { revalidate: 30 },
    );

    const rows = await fetchUpstream(upstreamUrl.toString());
    if (rows) {
      const items = (rows as UpstreamLeaderboardRow[])
        .map((r) => {
          const wallet = String(r.proxyWallet ?? r.wallet ?? '');
          const profit = Number(r.pnl ?? r.profit ?? 0);
          const volume = Number(r.vol ?? r.volume ?? 0);
          const roi = volume > 0 ? profit / volume : 0;
          return { wallet, profit, volume, roi };
        })
        .filter((r) => r.wallet);

      const resp = NextResponse.json({
        orderBy: safeOrderBy,
        timePeriod: safeTime,
        category: safeCategory,
        limit,
        items,
      });
      resp.headers.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
      return resp;
    }
  }

  const loadLocalLeaderboard = unstable_cache(
    async (orderColumnValue: string, limitValue: number) => {
      return prisma.$queryRawUnsafe<
        {
          wallet_address: string;
          total_volume: number;
          total_pnl: number;
          roi: number;
        }[]
      >(
        `
        SELECT 
          p.wallet_address,
          COALESCE(p.total_volume::float, 0) AS total_volume,
          COALESCE(s.total_pnl::float, 0) AS total_pnl,
          COALESCE(s.roi::float, 0) AS roi
        FROM whale_profiles p
        LEFT JOIN whale_stats s ON s.wallet_address = p.wallet_address
        ORDER BY ${orderColumnValue} DESC NULLS LAST
        LIMIT $1
        `,
        limitValue,
      );
    },
    ['local-leaderboard'],
    { revalidate: 30 },
  );

  const rows = await loadLocalLeaderboard(orderColumn, limit);

  const items = (rows || []).map((r) => ({
    wallet: r.wallet_address,
    volume: Number.isFinite(r.total_volume) ? r.total_volume : 0,
    profit: Number.isFinite(r.total_pnl) ? r.total_pnl : 0,
    roi: Number.isFinite(r.roi) ? r.roi : 0,
  }));

  const resp = NextResponse.json({
    orderBy: safeOrderBy,
    timePeriod: safeTime,
    category: safeCategory,
    limit,
    items,
  });
  resp.headers.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
  return resp;
}
