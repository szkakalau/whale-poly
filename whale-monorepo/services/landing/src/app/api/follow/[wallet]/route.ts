import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

type Params = {
  params: Promise<{ wallet: string }>;
};

export async function DELETE(_: Request, { params }: Params) {
  const { wallet } = await params;
  const user = await requireUser();
  const normalized = wallet.trim().toLowerCase();
  if (!normalized) {
    return NextResponse.json({ detail: 'wallet_required' }, { status: 400 });
  }
  await prisma.whaleFollow.deleteMany({
    where: {
      userId: user.id,
      wallet: normalized,
    },
  });
  return NextResponse.json({ ok: true });
}

