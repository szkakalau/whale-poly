/**
 * Market subscription API — Phase 3 E5.
 *
 * POST   /api/analyze/subscribe     { marketSlug, marketTitle, userId }
 * DELETE /api/analyze/subscribe     { marketSlug, userId }
 * GET    /api/analyze/subscribe?userId=...  → list subscriptions
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { analyzeMarket } from '@/lib/analysis-engine';

export async function POST(req: Request) {
  let body: { marketSlug?: string; marketTitle?: string; userId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { marketSlug, marketTitle, userId } = body;
  if (!marketSlug || !userId) {
    return NextResponse.json({ error: 'missing marketSlug or userId' }, { status: 400 });
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
      where: { user_market_unique: { userId, marketSlug } },
      update: { enabled: true, marketTitle: marketTitle || undefined, lastDirection, lastConfidence },
      create: { userId, marketSlug, marketTitle: marketTitle || null, lastDirection, lastConfidence },
    });
    return NextResponse.json({ ok: true, subscription: sub });
  } catch (err) {
    return NextResponse.json({ error: 'db_error', message: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const marketSlug = searchParams.get('marketSlug');
  if (!userId || !marketSlug) {
    return NextResponse.json({ error: 'missing userId or marketSlug' }, { status: 400 });
  }

  try {
    await prisma.marketSubscription.updateMany({
      where: { userId, marketSlug },
      data: { enabled: false },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'db_error', message: String(err) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'missing userId' }, { status: 400 });
  }

  try {
    const subs = await prisma.marketSubscription.findMany({
      where: { userId, enabled: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ subscriptions: subs });
  } catch (err) {
    return NextResponse.json({ error: 'db_error', message: String(err) }, { status: 500 });
  }
}
