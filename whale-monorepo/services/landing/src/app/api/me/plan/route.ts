import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ plan: 'FREE', planExpireAt: null });
  }

  return NextResponse.json({
    plan: user.plan,
    planExpireAt: user.planExpireAt?.toISOString() || null,
  });
}
