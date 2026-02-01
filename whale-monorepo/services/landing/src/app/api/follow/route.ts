import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { validateFollowPayload } from './types';

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
