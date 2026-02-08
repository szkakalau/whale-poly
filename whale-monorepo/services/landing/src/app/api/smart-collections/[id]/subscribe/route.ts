import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { canAccessFeature, getLimitValue } from '@/lib/plans';

type Params = {
  params: Promise<{ id: string }>;
};

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

  if (!canAccessFeature(user, 'smart_collection_access')) {
    return NextResponse.json(
      { 
        detail: 'plan_restricted',
        message: '该功能仅限 Pro 或 Elite 计划用户使用。' 
      },
      { status: 403 }
    );
  }

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
    const limit = getLimitValue(user, 'max_smart_collections');
    if (limit !== 'unlimited') {
      const count = await prisma.smartCollectionSubscription.count({
        where: { userId: user.id },
      });

      if (count >= limit) {
        return NextResponse.json(
          {
            detail: 'subscription_limit_reached',
            message: `已达到计划的 Smart Collection 订阅上限 (${limit} 个)，请升级更高计划解锁更多。`,
          },
          { status: 403 },
        );
      }
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
