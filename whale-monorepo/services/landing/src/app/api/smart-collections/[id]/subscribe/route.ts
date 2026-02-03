import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

type Params = {
  params: Promise<{ id: string }>;
};

const PLAN_LIMITS = {
  free: 0,
  pro: 5,
  elite: 20,
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

async function ensureSmartCollection(id: string) {
  const sc = await prisma.smartCollection.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      enabled: true,
    },
  });
  return sc;
}

export async function POST(_: Request, { params }: Params) {
  const user = await requireUser();
  const { id } = await params;

  const sc = await ensureSmartCollection(id);
  if (!sc || !sc.enabled) {
    return NextResponse.json({ detail: 'not_found' }, { status: 404 });
  }

  const existing = await prisma.smartCollectionSubscription.findUnique({
    where: {
      user_smart_collection_unique: {
        userId: user.id,
        smartCollectionId: sc.id,
      },
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    const plan = await getUserPlan(user.telegramId);
    const limit = PLAN_LIMITS[plan] ?? 0;

    const count = await prisma.smartCollectionSubscription.count({
      where: {
        userId: user.id,
      },
    });

    if (count >= limit) {
      const upgradeMsg = plan === 'free' 
        ? 'Free 计划无法订阅 Smart Collections，请升级 Pro 或 Elite 计划。'
        : `已达到 ${plan.toUpperCase()} 计划的 Smart Collections 上限 (${limit} 个)，请升级更高计划解锁更多。`;
      
      return NextResponse.json(
        { 
          detail: 'subscription_limit_reached',
          message: upgradeMsg,
          plan: plan,
          limit: limit
        },
        { status: 403 },
      );
    }
  }

  await prisma.smartCollectionSubscription.upsert({
    where: {
      user_smart_collection_unique: {
        userId: user.id,
        smartCollectionId: sc.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      smartCollectionId: sc.id,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Params) {
  const user = await requireUser();
  const { id } = await params;

  await prisma.smartCollectionSubscription.deleteMany({
    where: {
      userId: user.id,
      smartCollectionId: id,
    },
  });

  return NextResponse.json({ ok: true });
}
