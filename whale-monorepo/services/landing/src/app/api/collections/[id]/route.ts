import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import {
  validateCollectionPayload,
  type CollectionDetailResponse,
} from '../types';

type Params = {
  params: Promise<{ id: string }>;
};

async function loadCollectionForUser(userId: string, id: string) {
  const col = await prisma.collection.findFirst({
    where: {
      id,
      userId,
    },
    include: {
      whales: {
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });
  return col;
}

export async function GET(_: Request, { params }: Params) {
  const user = await requireUser();
  const { id } = await params;

  const col = await loadCollectionForUser(user.id, id);
  if (!col) {
    return NextResponse.json({ detail: 'not_found' }, { status: 404 });
  }

  const payload: CollectionDetailResponse = {
    id: col.id,
    name: col.name,
    description: col.description ?? '',
    enabled: col.enabled,
    created_at: col.createdAt.toISOString(),
    updated_at: col.updatedAt.toISOString(),
    whales: col.whales.map((w: (typeof col.whales)[number]) => {
      return {
        wallet: w.wallet,
        created_at: w.createdAt.toISOString(),
        updated_at: w.updatedAt.toISOString(),
      };
    }),
  };

  return NextResponse.json(payload);
}

export async function PUT(req: Request, { params }: Params) {
  const user = await requireUser();
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: 'invalid_json' }, { status: 400 });
  }

  let data;
  try {
    data = validateCollectionPayload(body);
  } catch (e) {
    const code = e instanceof Error ? e.message : 'validation_error';
    return NextResponse.json({ detail: code }, { status: 400 });
  }

  const col = await loadCollectionForUser(user.id, id);
  if (!col) {
    return NextResponse.json({ detail: 'not_found' }, { status: 404 });
  }

  const updated = await prisma.collection.update({
    where: { id: col.id },
    data: {
      name: data.name,
      description: data.description ?? '',
      enabled: data.enabled ?? col.enabled,
    },
  });

  const payload: CollectionDetailResponse = {
    id: updated.id,
    name: updated.name,
    description: updated.description ?? '',
    enabled: updated.enabled,
    created_at: updated.createdAt.toISOString(),
    updated_at: updated.updatedAt.toISOString(),
    whales: col.whales.map((w: (typeof col.whales)[number]) => {
      return {
        wallet: w.wallet,
        created_at: w.createdAt.toISOString(),
        updated_at: w.updatedAt.toISOString(),
      };
    }),
  };

  return NextResponse.json(payload);
}

export async function DELETE(_: Request, { params }: Params) {
  const user = await requireUser();
  const { id } = await params;

  const col = await loadCollectionForUser(user.id, id);
  if (!col) {
    return NextResponse.json({ detail: 'not_found' }, { status: 404 });
  }

  await prisma.collection.delete({
    where: { id: col.id },
  });

  return NextResponse.json({ ok: true });
}
