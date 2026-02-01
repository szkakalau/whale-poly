import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { type SmartCollectionSummary } from './types';

export async function GET() {
  const user = await requireUser();

  const rows = await prisma.smartCollection.findMany({
    where: {
      enabled: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      _count: {
        select: { whales: true },
      },
      subscriptions: {
        where: {
          userId: user.id,
        },
        select: { id: true },
      },
    },
  });

  const items: SmartCollectionSummary[] = rows.map(
    (c: (typeof rows)[number]) => {
      return {
        id: c.id,
        name: c.name,
        description: c.description ?? '',
        rule_json: c.ruleJson,
        enabled: c.enabled,
        created_at: c.createdAt.toISOString(),
        updated_at: c.updatedAt.toISOString(),
        whale_count: c._count.whales,
        subscribed: c.subscriptions.length > 0,
      };
    },
  );

  return NextResponse.json(items);
}

