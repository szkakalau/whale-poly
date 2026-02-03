import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import {
  validateCollectionPayload,
  type CollectionResponse,
} from './types';

const PLAN_LIMITS = {
  free: 0,
  pro: 10,
  elite: 50,
};

async function getUserPlan(telegramId: string | null) {
  if (!telegramId) return 'free';
  const now = new Date();
  const sub = await (prisma as any).subscription.findFirst({
    where: {
      telegramId,
      status: { in: ['active', 'trialing'] },
      currentPeriodEnd: { gt: now },
    },
    orderBy: {
      currentPeriodEnd: 'desc',
    },
    select: {
      plan: true,
    },
  });
  return (sub?.plan || 'free') as keyof typeof PLAN_LIMITS;
}

export async function POST(req: Request) {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: 'invalid_json' }, { status: 400 });
  }

  let data;
  try {
    data = validateCollectionPayload(body);
  } catch (e) {
    const code = e instanceof Error ? e.message : 'validation_error';
    return NextResponse.json({ detail: code }, { status: 400 });
  }

  const plan = await getUserPlan(user.telegramId);
  const limit = PLAN_LIMITS[plan] ?? 0;
  const count = await prisma.collection.count({
    where: { userId: user.id },
  });

  if (count >= limit) {
    const upgradeMsg = plan === 'free'
      ? 'Free 计划无法创建集合，请升级 Pro 或 Elite 计划。'
      : `已达到 ${plan.toUpperCase()} 计划的集合上限 (${limit} 个)，请升级更高计划解锁更多。`;

    return NextResponse.json(
      { 
        detail: 'collection_limit_reached',
        message: upgradeMsg 
      },
      { status: 403 }
    );
  }

  const created = await prisma.collection.create({
    data: {
      userId: user.id,
      name: data.name,
      description: data.description ?? '',
      enabled: data.enabled ?? true,
    },
  });

  const payload: CollectionResponse = {
    id: created.id,
    name: created.name,
    description: created.description ?? '',
    enabled: created.enabled,
    created_at: created.createdAt.toISOString(),
    updated_at: created.updatedAt.toISOString(),
  };

  return NextResponse.json(payload, { status: 201 });
}

export async function GET() {
  const user = await requireUser();

  const rows = await prisma.collection.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      whales: {
        select: { id: true },
      },
    },
  });

  const items: CollectionResponse[] = rows.map((c: typeof rows[number]) => {
    return {
      id: c.id,
      name: c.name,
      description: c.description ?? '',
      enabled: c.enabled,
      created_at: c.createdAt.toISOString(),
      updated_at: c.updatedAt.toISOString(),
      whale_count: c.whales.length,
    };
  });

  return NextResponse.json(items);
}
