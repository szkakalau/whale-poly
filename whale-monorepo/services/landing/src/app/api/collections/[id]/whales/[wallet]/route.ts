import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

type Params = {
  params: Promise<{ id: string; wallet: string }>;
};

async function ensureCollectionOwner(userId: string, id: string) {
  const col = await prisma.collection.findFirst({
    where: {
      id,
      userId,
    },
    select: {
      id: true,
    },
  });
  return col;
}

export async function DELETE(_: Request, { params }: Params) {
  const user = await requireUser();
  const { id, wallet } = await params;

  const col = await ensureCollectionOwner(user.id, id);
  if (!col) {
    return NextResponse.json({ detail: 'not_found' }, { status: 404 });
  }

  const normalized = wallet.trim().toLowerCase();
  if (!normalized) {
    return NextResponse.json({ detail: 'wallet_required' }, { status: 400 });
  }

  await prisma.collectionWhale.deleteMany({
    where: {
      collectionId: col.id,
      wallet: normalized,
    },
  });

  return NextResponse.json({ ok: true });
}

