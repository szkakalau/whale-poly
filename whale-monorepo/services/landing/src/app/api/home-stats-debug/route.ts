import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

function safeNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(request: Request) {
  const adminToken = process.env.ADMIN_TOKEN || '';
  const headerToken = request.headers.get('x-admin-token') || '';
  if (!adminToken || headerToken !== adminToken) {
    return NextResponse.json({ detail: 'not_found' }, { status: 404 });
  }

  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  if (!hasDatabaseUrl) {
    return NextResponse.json({
      hasDatabaseUrl: false,
      summary: 'DATABASE_URL is not set; Prisma cannot query and home stats will show as zero.',
    });
  }

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  let whaleProfilesSchemas: string[] = [];
  let whaleProfilesTableError: string | null = null;
  try {
    const rows = await prisma.$queryRaw<{ table_schema: string }[]>(
      Prisma.sql`SELECT table_schema FROM information_schema.tables WHERE table_name = 'whale_profiles'`,
    );
    whaleProfilesSchemas = (rows || []).map((r) => r.table_schema).filter(Boolean);
  } catch (e) {
    whaleProfilesTableError = e instanceof Error ? e.message : String(e);
  }

  let whaleAgg: { whale_count: number; total_volume: number } | null = null;
  let whaleAggError: string | null = null;
  try {
    const agg = await prisma.$queryRawUnsafe<{ whale_count: unknown; total_volume: unknown }[]>(
      `
      SELECT
        COUNT(*)::bigint AS whale_count,
        COALESCE(SUM(total_volume)::float, 0) AS total_volume
      FROM whale_profiles
      `,
    );
    const row = agg[0];
    whaleAgg = {
      whale_count: Number(BigInt(String(row?.whale_count ?? 0))),
      total_volume: safeNumber(row?.total_volume, 0),
    };
  } catch (e) {
    whaleAggError = e instanceof Error ? e.message : String(e);
  }

  let tradeAgg: { whale_count: number; total_volume: number } | null = null;
  let tradeAggError: string | null = null;
  try {
    const agg = await prisma.$queryRawUnsafe<{ whale_count: unknown; total_volume: unknown }[]>(
      `
      SELECT
        COUNT(DISTINCT wt.wallet_address)::bigint AS whale_count,
        COALESCE(SUM((tr.amount::numeric * tr.price::numeric))::double precision, 0) AS total_volume
      FROM whale_trades wt
      INNER JOIN trades_raw tr ON tr.trade_id = wt.trade_id
      `,
    );
    const row = agg[0];
    if (row) {
      tradeAgg = {
        whale_count: Number(BigInt(String(row.whale_count ?? 0))),
        total_volume: safeNumber(row.total_volume, 0),
      };
    }
  } catch (e) {
    tradeAggError = e instanceof Error ? e.message : String(e);
  }

  let alertEvents30d: number | null = null;
  let alertEventsError: string | null = null;
  try {
    alertEvents30d = await prisma.alertEvent.count({ where: { occurredAt: { gte: since30d } } });
  } catch (e) {
    alertEventsError = e instanceof Error ? e.message : String(e);
  }

  let alertsTable30d: number | null = null;
  let alertsTableError: string | null = null;
  try {
    const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(*)::bigint AS n FROM alerts WHERE created_at >= $1`,
      since30d,
    );
    alertsTable30d = Number(rows[0]?.n ?? 0);
  } catch (e) {
    alertsTableError = e instanceof Error ? e.message : String(e);
  }

  const whaleTableMissing = whaleProfilesSchemas.length === 0 && !whaleProfilesTableError;
  const whaleQueryFailed = Boolean(whaleAggError);
  const whaleEmpty = Boolean(whaleAgg && whaleAgg.whale_count === 0 && whaleAgg.total_volume === 0);
  const tradeHasData = Boolean(tradeAgg && (tradeAgg.whale_count > 0 || tradeAgg.total_volume > 0));

  let summary: string;
  if (whaleProfilesTableError) {
    summary = `information_schema check failed: ${whaleProfilesTableError}`;
  } else if (whaleTableMissing) {
    summary = tradeHasData
      ? 'No whale_profiles table, but whale_trades + trades_raw has rows; home stats use this fallback aggregate.'
      : 'No whale_profiles table and the whale_trades fallback has no rows (or query failed); confirm Alembic and ingest use the same DATABASE_URL.';
  } else if (whaleQueryFailed) {
    summary = tradeHasData
      ? `whale_profiles aggregate failed (${whaleAggError}), but whale_trades fallback has data; home uses fallback values.`
      : `whale_profiles aggregate failed: ${whaleAggError}; fallback query also returned no usable data.`;
  } else if (whaleEmpty) {
    summary = tradeHasData
      ? 'whale_profiles is empty, but whale_trades + trades_raw has data; loadHomeStats uses that fallback (same as live-signals).'
      : 'Both whale_profiles and whale_trades fallbacks are zero: no whale trade rows yet, or DATABASE_URL points at an empty database.';
  } else {
    summary =
      'whale_profiles has data; if home still shows zero, check unstable_cache (60s TTL) or mismatched env across deploys.';
  }

  return NextResponse.json({
    hasDatabaseUrl: true,
    whaleProfilesSchemas,
    whaleProfilesTableError,
    whaleAgg,
    whaleAggError,
    tradeAgg,
    tradeAggError,
    alertEvents30d,
    alertEventsError,
    alertsTable30d,
    alertsTableError,
    summary,
    hints: [
      'Home prefers whale_profiles; when counts and volume are both zero it falls back to whale_trades INNER JOIN trades_raw.',
      'whale_profiles is created by whale-monorepo Alembic migrations and filled by trade ingest / whale profile jobs.',
      'In production, call this endpoint with header x-admin-token: <ADMIN_TOKEN>.',
    ],
  });
}
