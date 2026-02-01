import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
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
      return {
        wallet: w.wallet,
        snapshot_date: w.snapshotDate.toISOString(),
        created_at: w.createdAt.toISOString(),
        updated_at: w.updatedAt.toISOString(),
      };
    }),
  };

  return NextResponse.json(payload);
}
