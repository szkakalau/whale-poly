import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { Plan } from '@prisma/client';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { plan } = await req.json();

    if (!Object.values(Plan).includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // PRO/ELITE 升级必须通过 Stripe Checkout 或管理员授权。
    // 不允许任何环境下绕过支付直接升级。
    const adminToken = process.env.ADMIN_TOKEN || '';
    const headerToken = req.headers.get('x-admin-token') || '';
    const isAdmin = Boolean(adminToken) && headerToken === adminToken;
    if (!isAdmin && plan !== Plan.FREE) {
      return NextResponse.json({ error: 'Upgrade requires payment via checkout or admin authorization' }, { status: 403 });
    }

    const operations: any[] = [];

    if (plan === Plan.FREE) {
      // Downgrade to FREE: clear plan expiry, don't create a fake subscription
      operations.push(
        prisma.user.update({
          where: { id: user.id },
          data: {
            plan: Plan.FREE,
            planExpireAt: null,
          },
        }),
      );
    } else {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      operations.push(
        prisma.user.update({
          where: { id: user.id },
          data: {
            plan: plan as Plan,
            planExpireAt: expiresAt,
          },
        }),
        prisma.subscription.create({
          data: {
            userId: user.id,
            plan: plan as Plan,
            price: plan === Plan.PRO ? 29 : plan === Plan.ELITE ? 59 : 0,
            status: 'active',
            expiresAt: expiresAt,
          },
        }),
      );
    }

    await prisma.$transaction(operations);

    return NextResponse.json({ success: true, plan });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
