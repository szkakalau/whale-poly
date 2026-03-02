import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { canAccessFeature } from '@/lib/plans';
import { type SmartCollectionDetail } from '../types';

type Params = {
  params: Promise<{ id: string }>;
};

async function loadSmartCollection(id: string, userId: string) {
  const row = await prisma.smartCollection.findUnique({
    where: {
      id,
    },
    include: {
      _count: {
        select: { whales: true },
      },
      whales: {
        orderBy: {
          snapshotDate: 'desc',
        },
      },
      subscriptions: {
        where: {
          userId,
        },
        select: {
          id: true,
        },
      },
    },
  });
  return row;
}

export async function GET(_: Request, { params }: Params) {
  const user = await requireUser();

  if (!canAccessFeature(user, 'smart_collection_access')) {
    return NextResponse.json({ detail: 'plan_restricted' }, { status: 403 });
  }

  const { id } = await params;

  const sc = await loadSmartCollection(id, user.id);
  if (!sc || !sc.enabled) {
    return NextResponse.json({ detail: 'not_found' }, { status: 404 });
  }

  const allWhales = sc.whales;
  let latestWhales = allWhales;
  if (allWhales.length > 0) {
    const latest = allWhales[0].snapshotDate;
    latestWhales = allWhales.filter(
      (w: (typeof allWhales)[number]) =>
        w.snapshotDate.getTime() === latest.getTime(),
    );
  }

  const wallets = latestWhales.map((w: (typeof latestWhales)[number]) => w.wallet);
  let stats: { wallet_address: string; volume: number; profit: number; roi: number; ord: number }[] = [];
  if (wallets.length > 0) {
    stats = await prisma.$queryRawUnsafe<
      { wallet_address: string; volume: number; profit: number; roi: number; ord: number }[]
    >(
      `
      SELECT 
        t.wallet AS wallet_address,
        COALESCE(p.total_volume::float, 0) AS volume,
        COALESCE(s.total_pnl::float, p.realized_pnl::float, 0) AS profit,
        COALESCE(s.roi::float, CASE WHEN COALESCE(p.total_volume::float, 0) > 0 THEN (COALESCE(s.total_pnl::float, p.realized_pnl::float, 0) / COALESCE(p.total_volume::float, 1)) ELSE 0 END) AS roi,
        t.ord
      FROM unnest($1::text[]) WITH ORDINALITY AS t(wallet, ord)
      LEFT JOIN whale_profiles p ON p.wallet_address = t.wallet
      LEFT JOIN whale_stats s ON s.wallet_address = t.wallet
      ORDER BY t.ord ASC
      `,
      wallets,
    );
  }
  const statsMap = new Map(
    stats.map((s) => [
      s.wallet_address,
      {
        volume: Number.isFinite(s.volume) ? s.volume : 0,
        profit: Number.isFinite(s.profit) ? s.profit : 0,
        roi: Number.isFinite(s.roi) ? s.roi : 0,
      },
    ]),
  );

  const payload: SmartCollectionDetail = {
    id: sc.id,
    name: sc.name,
    description: sc.description ?? '',
    rule_json: sc.ruleJson,
    enabled: sc.enabled,
    created_at: sc.createdAt.toISOString(),
    updated_at: sc.updatedAt.toISOString(),
    whale_count: sc._count.whales,
    subscribed: sc.subscriptions.length > 0,
    whales: latestWhales.map((w: (typeof latestWhales)[number]) => {
      const stat = statsMap.get(w.wallet) || { profit: 0, roi: 0, volume: 0 };
      return {
        wallet: w.wallet,
        snapshot_date: w.snapshotDate.toISOString(),
        created_at: w.createdAt.toISOString(),
        updated_at: w.updatedAt.toISOString(),
        profit: stat.profit,
        roi: stat.roi,
        volume: stat.volume,
      };
    }),
  };

  return NextResponse.json(payload);
}
