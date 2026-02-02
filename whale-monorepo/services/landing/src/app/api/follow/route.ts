import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { validateFollowPayload } from './types';

const PLAN_LIMITS = {
  free: 0,
  pro: 100,
  elite: 1000,
};

async function getUserPlan(telegramId: string | null) {
  if (!telegramId) return 'free';
  const now = new Date();
  const sub = await prisma.subscription.findFirst({
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
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ detail: 'invalid json' }, { status: 400 });
  }
  let data;
  try {
    data = validateFollowPayload(payload);
  } catch (e) {
    const code = e instanceof Error ? e.message : 'validation_error';
    return NextResponse.json({ detail: code }, { status: 400 });
  }
  const user = await requireUser();

  // Check if it's a new follow
  const existing = await prisma.whaleFollow.findUnique({
    where: {
      user_wallet_unique: {
        userId: user.id,
        wallet: data.wallet.toLowerCase(),
      },
    },
    select: { id: true },
  });

  if (!existing) {
    const plan = await getUserPlan(user.telegramId);
    const limit = PLAN_LIMITS[plan] ?? 0;
    const count = await prisma.whaleFollow.count({
      where: { userId: user.id },
    });

    if (count >= limit) {
      const upgradeMsg = plan === 'free'
        ? 'Free 计划无法关注鲸鱼，请升级 Pro 或 Elite 计划。'
        : `已达到 ${plan.toUpperCase()} 计划的关注上限 (${limit} 个)，请升级更高计划解锁更多。`;

      return NextResponse.json(
        { 
          detail: 'follow_limit_reached',
          message: upgradeMsg 
        },
        { status: 403 }
      );
    }
  }

  const follow = await prisma.whaleFollow.upsert({
    where: {
      user_wallet_unique: {
        userId: user.id,
        wallet: data.wallet.toLowerCase(),
      },
    },
    update: {
      alertEntry: data.alert_entry,
      alertExit: data.alert_exit,
      alertAdd: data.alert_add,
      minSize: data.min_size,
      minScore: data.min_score,
      enabled: true,
    },
    create: {
      userId: user.id,
      wallet: data.wallet.toLowerCase(),
      alertEntry: data.alert_entry,
      alertExit: data.alert_exit,
      alertAdd: data.alert_add,
      minSize: data.min_size,
      minScore: data.min_score,
      enabled: true,
    },
  });
  return NextResponse.json(
    {
      id: follow.id,
      wallet: follow.wallet,
      alert_entry: follow.alertEntry,
      alert_exit: follow.alertExit,
      alert_add: follow.alertAdd,
      min_size: follow.minSize,
      min_score: follow.minScore,
      enabled: follow.enabled,
    },
    { status: 200 }
  );
}

export async function GET() {
  const user = await requireUser();
  const rows = await prisma.whaleFollow.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
  const items = rows.map((follow: typeof rows[number]) => ({
    id: follow.id,
    wallet: follow.wallet,
    alert_entry: follow.alertEntry,
    alert_exit: follow.alertExit,
    alert_add: follow.alertAdd,
    min_size: follow.minSize,
    min_score: follow.minScore,
    enabled: follow.enabled,
    created_at: follow.createdAt,
    updated_at: follow.updatedAt,
  }));
  return NextResponse.json(items);
}
