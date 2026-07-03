/**
 * Conviction change detection endpoint — Phase 3 E5.
 *
 * GET /api/analyze/check-changes
 *
 * Iterates all active market subscriptions, re-analyzes each market,
 * and returns markets where conviction has significantly changed.
 * Designed to be called by a cron job (every 5-10 minutes).
 *
 * Significant change thresholds:
 *   - Direction flipped (bullish ↔ bearish)
 *   - Confidence changed by >= 20 points
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { analyzeMarket } from '@/lib/analysis-engine';

const CONFIDENCE_CHANGE_THRESHOLD = 20;

type ChangeRecord = {
  subscriptionId: string;
  userId: string;
  marketSlug: string;
  marketTitle: string | null;
  oldDirection: string | null;
  newDirection: string;
  oldConfidence: number | null;
  newConfidence: number;
  changeType: 'direction_flip' | 'confidence_jump' | 'confidence_drop';
};

export async function GET(req: Request) {
  // Cron endpoint — require admin token (called by Vercel Cron Jobs or internal scheduler)
  const adminToken = process.env.ADMIN_TOKEN || '';
  const headerToken = req.headers.get('x-admin-token') || '';
  if (!adminToken || headerToken !== adminToken) {
    return NextResponse.json({ detail: 'not_found' }, { status: 404 });
  }

  // Get all enabled subscriptions
  const subs = await prisma.marketSubscription.findMany({
    where: { enabled: true },
  });

  if (subs.length === 0) {
    return NextResponse.json({ changes: [] });
  }

  // Group by market to avoid redundant analyses
  const marketMap = new Map<string, typeof subs>();
  for (const s of subs) {
    const existing = marketMap.get(s.marketSlug);
    if (existing) {
      existing.push(s);
    } else {
      marketMap.set(s.marketSlug, [s]);
    }
  }

  const changes: ChangeRecord[] = [];

  for (const [marketSlug, marketSubs] of marketMap) {
    let analysis: Awaited<ReturnType<typeof analyzeMarket>>;
    try {
      analysis = await analyzeMarket(marketSlug);
    } catch {
      continue;
    }

    for (const sub of marketSubs) {
      const oldDir = sub.lastDirection;
      const newDir = analysis.direction;
      const oldConf = sub.lastConfidence;
      const newConf = analysis.confidenceScore;

      let changeType: ChangeRecord['changeType'] | null = null;

      // Direction flip
      if (oldDir && newDir !== oldDir) {
        if (
          (oldDir === 'bullish' && newDir === 'bearish') ||
          (oldDir === 'bearish' && newDir === 'bullish')
        ) {
          changeType = 'direction_flip';
        }
      }

      // Confidence change
      if (oldConf != null && changeType === null) {
        const delta = newConf - oldConf;
        if (delta >= CONFIDENCE_CHANGE_THRESHOLD) {
          changeType = 'confidence_jump';
        } else if (delta <= -CONFIDENCE_CHANGE_THRESHOLD) {
          changeType = 'confidence_drop';
        }
      }

      if (changeType) {
        changes.push({
          subscriptionId: sub.id,
          userId: sub.userId,
          marketSlug,
          marketTitle: sub.marketTitle,
          oldDirection: oldDir,
          newDirection: newDir,
          oldConfidence: oldConf,
          newConfidence: newConf,
          changeType,
        });

        // Update stored state
        try {
          await prisma.marketSubscription.update({
            where: { id: sub.id },
            data: {
              lastDirection: newDir,
              lastConfidence: newConf,
              lastNotifiedAt: new Date(),
            },
          });
        } catch {
          // Non-blocking
        }
      }
    }
  }

  return NextResponse.json({ changes });
}
