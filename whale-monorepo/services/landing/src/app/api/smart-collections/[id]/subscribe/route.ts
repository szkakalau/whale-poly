import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

type Params = {
  params: Promise<{ id: string }>;
};

const MAX_SUBSCRIPTIONS_PER_USER = 5;

async function ensureSmartCollection(id: string) {
  const sc = await prisma.smartCollection.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      enabled: true,
    },
  });
  return sc;
}

export async function POST(_: Request, { params }: Params) {
  const user = await requireUser();
  const { id } = await params;

  const sc = await ensureSmartCollection(id);
  if (!sc || !sc.enabled) {
    return NextResponse.json({ detail: 'not_found' }, { status: 404 });
  }

  const existing = await prisma.smartCollectionSubscription.findUnique({
    where: {
      user_smart_collection_unique: {
        userId: user.id,
        smartCollectionId: sc.id,
      },
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    const count = await prisma.smartCollectionSubscription.count({
      where: {
        userId: user.id,
      },
    });
    if (count >= MAX_SUBSCRIPTIONS_PER_USER) {
      return NextResponse.json(
        { detail: 'subscription_limit_reached' },
        { status: 403 },
      );
    }
  }

  await prisma.smartCollectionSubscription.upsert({
    where: {
      user_smart_collection_unique: {
        userId: user.id,
        smartCollectionId: sc.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      smartCollectionId: sc.id,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Params) {
  const user = await requireUser();
  const { id } = await params;

  await prisma.smartCollectionSubscription.deleteMany({
    where: {
      userId: user.id,
      smartCollectionId: id,
    },
  });

  return NextResponse.json({ ok: true });
}
