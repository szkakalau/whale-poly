/**
 * GET /api/market-correlation?hours=48&minOverlap=5&minAbsR=0.3
 *
 * Returns pairwise market correlations based on VW divergence time series,
 * plus category-level fund flow analysis.
 *
 * Elite-tier only — gated via plans.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { computeMarketCorrelations, computeCategoryFlows } from '@/lib/market-correlation';
import { getCurrentUser } from '@/lib/auth';
import { effectivePlan, canAccessFeature } from '@/lib/plans';

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=900',
};

function cached(body: object, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...(init?.headers as Record<string, string> | undefined), ...CACHE_HEADERS },
  });
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return cached({ error: 'Authentication required' }, { status: 401 });
    }

    const plan = effectivePlan(user);

    if (!canAccessFeature(user, 'market_correlation')) {
      return cached(
        {
          error: 'Market correlation analysis requires Elite plan',
          currentPlan: plan,
          upgradeUrl: '/pricing',
        },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const hoursRaw = parseInt(searchParams.get('hours') || '48', 10);
    const hours = Number.isFinite(hoursRaw) ? Math.min(Math.max(hoursRaw, 1), 168) : 48;
    const minOverlapRaw = parseInt(searchParams.get('minOverlap') || '5', 10);
    const minOverlap = Number.isFinite(minOverlapRaw) ? Math.max(minOverlapRaw, 3) : 5;
    const minAbsRRaw = parseFloat(searchParams.get('minAbsR') || '0.3');
    const minAbsR = Number.isFinite(minAbsRRaw) ? Math.min(Math.max(minAbsRRaw, 0), 1) : 0.3;

    const [correlations, categoryFlows] = await Promise.all([
      computeMarketCorrelations(hours, minOverlap, minAbsR),
      computeCategoryFlows(),
    ]);

    return cached({
      correlations,
      categoryFlows,
      params: { hours, minOverlap, minAbsR },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('/api/market-correlation error', err);
    return cached({ error: 'Internal server error' }, { status: 500 });
  }
}
