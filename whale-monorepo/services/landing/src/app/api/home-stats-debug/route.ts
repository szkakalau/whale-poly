import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

function safeNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    const adminToken = process.env.ADMIN_TOKEN || '';
    const headerToken = request.headers.get('x-admin-token') || '';
    if (!adminToken || headerToken !== adminToken) {
      return NextResponse.json({ detail: 'not_found' }, { status: 404 });
    }
  }

  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  if (!hasDatabaseUrl) {
    return NextResponse.json({
      hasDatabaseUrl: false,
      summary: '未设置 DATABASE_URL，Prisma 无法查询；首页统计会显示为 0。',
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
    summary = `检查 information_schema 失败：${whaleProfilesTableError}`;
  } else if (whaleTableMissing) {
    summary = tradeHasData
      ? '库中无 whale_profiles 表，但 whale_trades+trades_raw 有数据；首页统计会使用该回退聚合。'
      : '库中无 whale_profiles 表，且 whale_trades 回退也无数据（或查询失败）；请确认 Alembic 与 ingest 是否指向同一 DATABASE_URL。';
  } else if (whaleQueryFailed) {
    summary = tradeHasData
      ? `whale_profiles 聚合失败（${whaleAggError}），但 whale_trades 回退有数据；首页会使用回退值。`
      : `whale_profiles 聚合失败：${whaleAggError}；回退查询也无可用数据。`;
  } else if (whaleEmpty) {
    summary = tradeHasData
      ? 'whale_profiles 为空，但 whale_trades+trades_raw 有数据；首页 loadHomeStats 已回退使用该聚合（与 live-signals 一致）。'
      : 'whale_profiles 与 whale_trades 回退均为 0：库中尚无鲸鱼成交数据，或 DATABASE_URL 指向空库。';
  } else {
    summary = 'whale_profiles 有数据；若首页仍为 0，可能是 unstable_cache（60s）或部署环境变量不一致。';
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
      '首页优先聚合 whale_profiles；若计数与成交额均为 0，则回退聚合 whale_trades INNER JOIN trades_raw。',
      'whale_profiles 由 whale-monorepo 的 Alembic 迁移创建，并由 trade ingest / whale profile 任务写入。',
      '生产环境访问本接口需在请求头携带 x-admin-token: <ADMIN_TOKEN>。',
    ],
  });
}
