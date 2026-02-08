import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { canAccessFeature } from '@/lib/plans';
import { validateAddWhalePayload } from '../../../collections/types';

type Params = {
  params: Promise<{ id: string }>;
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

export async function POST(req: Request, { params }: Params) {
  const user = await requireUser();

  if (!canAccessFeature(user, 'collection_creation')) {
    return NextResponse.json({ detail: 'plan_restricted' }, { status: 403 });
  }

  const { id } = await params;

  const col = await ensureCollectionOwner(user.id, id);
  if (!col) {
    return NextResponse.json({ detail: 'not_found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: 'invalid_json' }, { status: 400 });
  }

  let data;
  try {
    data = validateAddWhalePayload(body);
  } catch (e) {
    const code = e instanceof Error ? e.message : 'validation_error';
    return NextResponse.json({ detail: code }, { status: 400 });
  }

  const normalized = data.wallet.trim().toLowerCase();
  if (!normalized) {
    return NextResponse.json({ detail: 'wallet_required' }, { status: 400 });
  }

  // Check whale limit per collection
  const currentCount = await prisma.collectionWhale.count({
    where: { collectionId: col.id },
  });

  const MAX_WHALES_PER_COLLECTION = 10; // Simple limit
  if (currentCount >= MAX_WHALES_PER_COLLECTION) {
    return NextResponse.json({ detail: 'collection_limit_reached' }, { status: 403 });
  }

  const created = await prisma.collectionWhale.upsert({
    where: {
      collection_wallet_unique: {
        collectionId: col.id,
        wallet: normalized,
      },
    },
    update: {},
    create: {
      collectionId: col.id,
      wallet: normalized,
    },
  });

  return NextResponse.json({
    wallet: created.wallet,
    created_at: created.createdAt.toISOString(),
    updated_at: created.updatedAt.toISOString(),
  });
}

