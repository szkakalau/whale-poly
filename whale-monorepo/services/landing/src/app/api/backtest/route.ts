/**
 * POST /api/backtest
 *
 * Runs a historical backtest over whale alert data, computing accuracy, win rate,
 * Sharpe ratio, max drawdown, and tier-level breakdowns.
 *
 * Elite-tier only — gated via plans.ts.
 *
 * Body: BacktestConfig
 * Response: BacktestReport
 */

import { NextRequest, NextResponse } from 'next/server';
import { runBacktest, runBasicBacktest, type BacktestConfig } from '@/lib/backtesting/engine';
import { getCurrentUser } from '@/lib/auth';
import { effectivePlan, canAccessFeature } from '@/lib/plans';

const CACHE_HEADERS = {
  'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
};

function cached(body: object, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...(init?.headers as Record<string, string> | undefined), ...CACHE_HEADERS },
  });
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return cached({ error: 'Authentication required' }, { status: 401 });
    }

    const plan = effectivePlan(user);

    if (!canAccessFeature(user, 'backtest_access')) {
      return cached(
        {
          error: 'Backtest access requires Elite plan',
          currentPlan: plan,
          upgradeUrl: '/pricing',
        },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null);

    if (!body || !body.startDate || !body.endDate) {
      return cached(
        { error: 'startDate and endDate are required (ISO date strings)' },
        { status: 400 },
      );
    }

    const config: BacktestConfig = {
      startDate: body.startDate,
      endDate: body.endDate,
      minWhaleScore: body.minWhaleScore ?? 0,
      minTradeSize: body.minTradeSize ?? 0,
      planTier: 'elite',
      walkForward: body.walkForward ?? { enabled: true, trainDays: 60, testDays: 30, stepDays: 30 },
    };

    const report = await runBacktest(config);

    return cached({ report });
  } catch (err) {
    console.error('/api/backtest error', err);
    return cached({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/backtest?start=...&end=...
 *
 * Lightweight summary for Pro tier — returns only winRate + avgRoi.
 * Full backtest still requires POST + Elite.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const plan = user ? effectivePlan(user) : 'free';

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start') || new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const endDate = searchParams.get('end') || new Date().toISOString().slice(0, 10);

    if (plan === 'ELITE') {
      // GET for Elite returns full backtest
      const config: BacktestConfig = {
        startDate,
        endDate,
        minWhaleScore: 0,
        minTradeSize: 0,
        planTier: 'elite',
      };
      const report = await runBacktest(config);
      return cached({ report });
    }

    // Non-Elite: basic summary only
    const summary = await runBasicBacktest(startDate, endDate);
    return cached({
      summary,
      note: 'Upgrade to Elite for full backtesting with walk-forward validation, Sharpe ratio, and max drawdown.',
    });
  } catch (err) {
    console.error('/api/backtest GET error', err);
    return cached({ error: 'Internal server error' }, { status: 500 });
  }
}
