/**
 * Market subscription API — Phase 3 E5.
 *
 * POST   /api/analyze/subscribe     { marketSlug, marketTitle }
 * DELETE /api/analyze/subscribe     { marketSlug }
 * GET    /api/analyze/subscribe     → list subscriptions
 *
 * All methods require authentication via session cookie or Bearer token.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { analyzeMarket } from '@/lib/analysis-engine';

export async function POST(req: Request) {
  const user = await requireUser();

  let body: { marketSlug?: string; marketTitle?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { marketSlug, marketTitle } = body;
  if (!marketSlug) {
    return NextResponse.json({ error: 'missing marketSlug' }, { status: 400 });
  }

  // Snapshot current conviction
  let lastDirection: string | null = null;
  let lastConfidence: number | null = null;
  try {
    const analysis = await analyzeMarket(marketSlug);
    lastDirection = analysis.direction;
    lastConfidence = analysis.confidenceScore;
  } catch {
    // Fine — store without initial snapshot
  }

  try {
    const sub = await prisma.marketSubscription.upsert({
      where: { user_market_unique: { userId: user.id, marketSlug } },
      update: { enabled: true, marketTitle: marketTitle || undefined, lastDirection, lastConfidence },
      create: { userId: user.id, marketSlug, marketTitle: marketTitle || null, lastDirection, lastConfidence },
    });
    return NextResponse.json({ ok: true, subscription: sub });
  } catch {
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const user = await requireUser();

  let body: { marketSlug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { marketSlug } = body;
  if (!marketSlug) {
    return NextResponse.json({ error: 'missing marketSlug' }, { status: 400 });
  }

  try {
    await prisma.marketSubscription.updateMany({
      where: { userId: user.id, marketSlug },
      data: { enabled: false },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }
}

export async function GET() {
  const user = await requireUser();

  try {
    const subs = await prisma.marketSubscription.findMany({
      where: { userId: user.id, enabled: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ subscriptions: subs });
  } catch {
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }
}
