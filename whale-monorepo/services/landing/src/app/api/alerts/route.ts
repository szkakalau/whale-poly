import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

export async function GET() {
  const user = await requireUser();
  const rows = await prisma.$queryRawUnsafe<
    {
      id: string;
      source_type: string;
      source_id: string | null;
      title: string;
      detail: string | null;
      outcome: string | null;
      occurred_at: Date;
    }[]
  >(
    `
    SELECT id, source_type, source_id, title, detail, outcome, occurred_at
    FROM alert_events
    WHERE user_id = $1
    ORDER BY occurred_at DESC
    LIMIT 20
    `,
    user.id,
  );
  return NextResponse.json(
    rows.map((row) => ({
      id: row.id,
      source_type: row.source_type,
      source_id: row.source_id,
      title: row.title,
      detail: row.detail,
      outcome: row.outcome,
      occurred_at: row.occurred_at.toISOString(),
    })),
  );
}

export async function POST(req: Request) {
  const token = req.headers.get('x-alert-token') || '';
  if (!process.env.ALERTS_INGEST_TOKEN || token !== process.env.ALERTS_INGEST_TOKEN) {
    return NextResponse.json({ detail: 'not_found' }, { status: 404 });
  }
  let payload: {
    wallet_address?: string;
    market_title?: string | null;
    market_question?: string | null;
    whale_score?: number | null;
    alert_type?: string | null;
    outcome?: string | null;
    created_at?: string | null;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ detail: 'invalid_json' }, { status: 400 });
  }
  const wallet = String(payload.wallet_address || '').toLowerCase().trim();
  if (!wallet) {
    return NextResponse.json({ detail: 'wallet_required' }, { status: 400 });
  }
  const occurredAt = payload.created_at ? new Date(payload.created_at) : new Date();
  const title = `Whale ${wallet.slice(0, 6)}…${wallet.slice(-4)} ${String(payload.alert_type || 'alert')}`;
  const detail =
    payload.market_title ||
    payload.market_question ||
    `Whale score ${(payload.whale_score ?? 0).toFixed(1)}`;
  const outcomeValue =
    typeof payload.outcome === 'string' && payload.outcome.trim()
      ? payload.outcome.trim()
      : null;
  const collectionCooldownMinutes = Number(process.env.ALERTS_COLLECTION_COOLDOWN_MINUTES || 15);
  const whaleCooldownMinutes = Number(process.env.ALERTS_WHALE_COOLDOWN_MINUTES || 10);
  const collectionCooldown = Number.isFinite(collectionCooldownMinutes)
    ? Math.max(1, collectionCooldownMinutes)
    : 15;
  const whaleCooldown = Number.isFinite(whaleCooldownMinutes) ? Math.max(1, whaleCooldownMinutes) : 10;
  const collectionCooldownSince = new Date(occurredAt.getTime() - collectionCooldown * 60 * 1000);
  const whaleCooldownSince = new Date(occurredAt.getTime() - whaleCooldown * 60 * 1000);
  const whaleUserRows = await prisma.whaleFollow.findMany({
    where: { wallet },
    select: { userId: true }
  });
  const collectionRows = await prisma.smartCollectionSubscription.findMany({
    where: {
      smartCollection: {
        whales: {
          some: { wallet }
        }
      }
    },
    select: {
      userId: true,
      smartCollectionId: true
    }
  });
  if (whaleUserRows.length === 0 && collectionRows.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0 });
  }
  let inserted = 0;
  for (const row of whaleUserRows) {
    const recent = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id
      FROM alert_events
      WHERE user_id = ${row.userId}
        AND source_type = 'whale'
        AND source_id = ${wallet}
        AND detail = ${detail}
        AND occurred_at >= ${whaleCooldownSince}
      LIMIT 1
    `);
    if (recent.length > 0) {
      continue;
    }
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO alert_events (id, user_id, source_type, source_id, title, detail, outcome, occurred_at)
      VALUES (${crypto.randomUUID()}, ${row.userId}, 'whale', ${wallet}, ${title}, ${detail}, ${outcomeValue}, ${occurredAt})
    `);
    inserted += 1;
  }
  const collectionTitle = payload.market_title || payload.market_question || 'Smart Collection Alert';
  for (const row of collectionRows) {
    const detailText = `Wallet ${wallet.slice(0, 6)}…${wallet.slice(-4)} triggered collection`;
    const recent = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id
      FROM alert_events
      WHERE user_id = ${row.userId}
        AND source_type = 'collection'
        AND source_id = ${row.smartCollectionId}
        AND detail = ${detailText}
        AND occurred_at >= ${collectionCooldownSince}
      LIMIT 1
    `);
    if (recent.length > 0) {
      continue;
    }
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO alert_events (id, user_id, source_type, source_id, title, detail, outcome, occurred_at)
      VALUES (${crypto.randomUUID()}, ${row.userId}, 'collection', ${row.smartCollectionId}, ${`Collection Alert · ${collectionTitle}`}, ${detailText}, ${outcomeValue}, ${occurredAt})
    `);
    inserted += 1;
  }
  return NextResponse.json({ ok: true, inserted });
}
