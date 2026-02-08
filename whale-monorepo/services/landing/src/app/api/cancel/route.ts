import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { Plan } from '@prisma/client';

export async function POST() {
  try {
    const user = await requireUser();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        plan: Plan.FREE,
        planExpireAt: null,
      },
    });

    await prisma.subscription.updateMany({
      where: { userId: user.id, status: 'active' },
      data: { status: 'cancelled' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
