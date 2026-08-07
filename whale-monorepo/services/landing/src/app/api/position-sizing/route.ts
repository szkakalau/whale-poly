/**
 * POST /api/position-sizing
 *
 * Computes Kelly Criterion position sizing based on historical signal performance.
 * Body: { marketSlug?, score, planTier?, tierStats? }
 *
 * Elite-tier only — gated via plans.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { computeKelly, kellyFromTiers, type TierStats } from '@/lib/position-sizing';
import { getCurrentUser } from '@/lib/auth';
import { effectivePlan, canAccessFeature } from '@/lib/plans';

const CACHE_HEADERS = {
  'Cache-Control': 'private, max-age=120, stale-while-revalidate=600',
};

function cached(body: object, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...(init?.headers as Record<string, string> | undefined), ...CACHE_HEADERS },
  });
}

interface PositionSizingRequest {
  marketSlug?: string;
  score: number;
  /** Pre-computed tier stats from a backtest summary. */
  tierStats?: TierStats[];
  /** Direct statistics (overrides tier lookup). */
  winRate?: number;
  avgWinRoi?: number;
  avgLossRoi?: number;
  sampleSize?: number;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return cached({ error: 'Authentication required' }, { status: 401 });
    }

    const plan = effectivePlan(user);

    if (!canAccessFeature(user, 'position_sizing')) {
      return cached(
        {
          error: 'Position sizing requires Elite plan',
          currentPlan: plan,
          upgradeUrl: '/pricing',
        },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null) as PositionSizingRequest | null;

    if (!body || body.score == null || !Number.isFinite(body.score) || body.score < 0 || body.score > 100) {
      return cached(
        { error: 'score must be between 0 and 100' },
        { status: 400 },
      );
    }

    if (body.winRate != null && (!Number.isFinite(body.winRate) || body.winRate < 0 || body.winRate > 1)) {
      return cached({ error: 'winRate must be between 0 and 1' }, { status: 400 });
    }

    if (body.avgWinRoi != null && (!Number.isFinite(body.avgWinRoi) || body.avgWinRoi <= 0)) {
      return cached({ error: 'avgWinRoi must be a positive number' }, { status: 400 });
    }

    if (body.avgLossRoi != null && (!Number.isFinite(body.avgLossRoi) || body.avgLossRoi <= 0)) {
      return cached({ error: 'avgLossRoi must be a positive number' }, { status: 400 });
    }

    let result;

    if (body.winRate != null && body.avgWinRoi != null && body.avgLossRoi != null) {
      // Direct statistics mode
      result = computeKelly(
        body.winRate,
        body.avgWinRoi,
        body.avgLossRoi,
        body.sampleSize ?? 0,
      );
    } else if (body.tierStats && body.tierStats.length > 0) {
      // Tier-based lookup
      result = kellyFromTiers(body.score, body.tierStats);
    } else {
      return cached(
        {
          error: 'Provide either (winRate, avgWinRoi, avgLossRoi) or tierStats[] for position sizing',
        },
        { status: 400 },
      );
    }

    return cached({
      marketSlug: body.marketSlug ?? null,
      score: body.score,
      sizing: result,
      disclaimer: 'Position sizing is for informational purposes only. Past performance does not guarantee future results.',
    });
  } catch (err) {
    console.error('/api/position-sizing error', err);
    return cached({ error: 'Internal server error' }, { status: 500 });
  }
}
