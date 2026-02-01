import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import {
  validateCollectionPayload,
  type CollectionResponse,
} from './types';

export async function POST(req: Request) {
  const user = await requireUser();

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

  const created = await prisma.collection.create({
    data: {
      userId: user.id,
      name: data.name,
      description: data.description ?? '',
      enabled: data.enabled ?? true,
    },
  });

  const payload: CollectionResponse = {
    id: created.id,
    name: created.name,
    description: created.description ?? '',
    enabled: created.enabled,
    created_at: created.createdAt.toISOString(),
    updated_at: created.updatedAt.toISOString(),
  };

  return NextResponse.json(payload, { status: 201 });
}

export async function GET() {
  const user = await requireUser();

  const rows = await prisma.collection.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      whales: {
        select: { id: true },
      },
    },
  });

  const items: CollectionResponse[] = rows.map((c: typeof rows[number]) => {
    return {
      id: c.id,
      name: c.name,
      description: c.description ?? '',
      enabled: c.enabled,
      created_at: c.createdAt.toISOString(),
      updated_at: c.updatedAt.toISOString(),
      whale_count: c.whales.length,
    };
  });

  return NextResponse.json(items);
}
