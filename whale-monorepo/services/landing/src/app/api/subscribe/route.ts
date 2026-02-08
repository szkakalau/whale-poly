import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { Plan } from '@prisma/client';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { plan, priceId } = await req.json();

    if (!Object.values(Plan).includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Mocking Stripe integration logic here
    // In production, you would create a Stripe checkout session
    console.log(`Creating subscription for user ${user.id} to plan ${plan}`);

    // Update user plan immediately for testing (Stub)
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await prisma.$transaction([
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
    ]);

    return NextResponse.json({ success: true, plan });
  } catch (error) {
    console.error('Subscription error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
