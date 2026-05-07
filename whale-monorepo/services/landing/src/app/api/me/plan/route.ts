import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isPaidLiveSignalsUser } from '@/lib/live-signals-access';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ plan: 'FREE', planExpireAt: null, isPaid: false });
  }

  return NextResponse.json({
    plan: user.plan,
    planExpireAt: user.planExpireAt?.toISOString() || null,
    isPaid: isPaidLiveSignalsUser(user),
  });
}
