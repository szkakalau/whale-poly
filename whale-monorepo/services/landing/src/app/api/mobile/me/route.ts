import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ detail: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    id: user.id,
    email: user.email,
    telegramId: user.telegramId,
    plan: user.plan,
    planExpireAt: user.planExpireAt?.toISOString() || null,
  });
}
