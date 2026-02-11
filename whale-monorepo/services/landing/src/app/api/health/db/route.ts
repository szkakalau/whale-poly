import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    await prisma.$queryRaw`select 1`;
    return NextResponse.json({ ok: true, db: 'ok', time: new Date().toISOString() });
  } catch (error) {
    console.error('db-health', error);
    return NextResponse.json(
      { ok: false, db: 'error', time: new Date().toISOString(), error: 'db_unreachable' },
      { status: 503 }
    );
  }
}
