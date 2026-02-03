import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.telegramId) {
    return NextResponse.json({ plan: 'free' });
  }

  const now = new Date();
  const sub = await (prisma as any).subscription.findFirst({
    where: {
      telegramId: user.telegramId,
      status: { in: ['active', 'trialing'] },
      currentPeriodEnd: { gt: now },
    },
    orderBy: {
      currentPeriodEnd: 'desc',
    },
    select: {
      plan: true,
      currentPeriodEnd: true,
    },
  });

  return NextResponse.json({
    plan: sub?.plan || 'free',
    current_period_end: sub?.currentPeriodEnd?.toISOString() || null,
  });
}
