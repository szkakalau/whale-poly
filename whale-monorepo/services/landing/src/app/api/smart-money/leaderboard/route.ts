import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Query = {
  searchParams: Promise<URLSearchParams>;
};

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
    const upstream = new URL('https://data-api.polymarket.com/v1/leaderboard');
    upstream.searchParams.set('category', safeCategory);
    upstream.searchParams.set('timePeriod', safeTime);
    upstream.searchParams.set('orderBy', safeOrderBy);
    upstream.searchParams.set('limit', String(limit));
    const res = await fetch(upstream.toString(), { cache: 'no-store' }).catch(() => null);
    if (res && res.ok) {
      const data = await res.json().catch(() => []);
      const rows = Array.isArray(data) ? data : [];
      const items = rows.map((r) => {
        const wallet = String(r.proxyWallet || r.wallet || '');
        const profit = Number(r.pnl || r.profit || 0);
        const volume = Number(r.vol || r.volume || 0);
        const roi = volume > 0 ? profit / volume : 0;
        return { wallet, profit, volume, roi };
      }).filter((r) => r.wallet);
      return NextResponse.json({
        orderBy: safeOrderBy,
        timePeriod: safeTime,
        category: safeCategory,
        limit,
        items,
      });
    }
  }

  const rows = await prisma.$queryRawUnsafe<
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
    ORDER BY ${orderColumn} DESC NULLS LAST
    LIMIT $1
    `,
    limit,
  );

  const items = (rows || []).map((r) => ({
    wallet: r.wallet_address,
    volume: Number.isFinite(r.total_volume) ? r.total_volume : 0,
    profit: Number.isFinite(r.total_pnl) ? r.total_pnl : 0,
    roi: Number.isFinite(r.roi) ? r.roi : 0,
  }));

  return NextResponse.json({
    orderBy: safeOrderBy,
    timePeriod: safeTime,
    category: safeCategory,
    limit,
    items,
  });
}
