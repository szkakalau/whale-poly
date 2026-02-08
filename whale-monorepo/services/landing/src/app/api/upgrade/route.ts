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
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
