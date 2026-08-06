/**
 * GET /api/prediction?market=xxx
 *
 * Returns a fused prediction for a single market by combining
 * whale quality, behavior, VW divergence, and flow direction signals.
 *
 * Plan gating:
 *   - Free: basic fusion (flow + behavior only, via fuseBasicSignals)
 *   - Pro/Elite: full fusion with whale quality + VW metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeMarket } from '@/lib/analysis-engine';
import { fuseSignals, fuseBasicSignals } from '@/lib/prediction-fusion';
import { getCurrentUser } from '@/lib/auth';
import { effectivePlan, canAccessFeature } from '@/lib/plans';
import { getVwMetrics } from '@/lib/vw-signals';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
};

function cached(body: object, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...(init?.headers as Record<string, string> | undefined), ...CACHE_HEADERS },
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const marketSlug = searchParams.get('market');

  if (!marketSlug) {
    return cached({ error: 'market parameter is required' }, { status: 400 });
  }

  try {
    // Plan detection: cookie auth first, then fallback to ?tier= query param
    // (used by Telegram bot which calls this API server-to-server).
    const user = await getCurrentUser();
    const tierParam = searchParams.get('tier')?.toUpperCase() as 'FREE' | 'PRO' | 'ELITE' | undefined;
    const plan = user
      ? effectivePlan(user)
      : (tierParam === 'PRO' || tierParam === 'ELITE' ? tierParam : 'free' as const);
    const isPaid = plan === 'PRO' || plan === 'ELITE';

    // Run the base analysis (works for all tiers)
    const analysis = await analyzeMarket(marketSlug);

    if (analysis.whaleTradeCount === 0) {
      return cached({
        prediction: null,
        message: `No qualifying whale trades found for "${marketSlug}" in the past 24 hours.`,
      });
    }

    if (isPaid) {
      // Full fusion: get whale quality from DB and VW metrics
      const [vwRows, whaleStats] = await Promise.all([
        getVwMetrics('divergence', 1).catch(() => []),
        (async () => {
          try {
            // Get whale_stats for wallets active in this market
            const walletAddrs = analysis.topWallets.map(w => w.addressShort);
            if (walletAddrs.length === 0) return null;

            const rows = await prisma.$queryRaw<{ whale_score: number }[]>(
              Prisma.sql`
                SELECT whale_score::int AS whale_score
                FROM whale_stats
                WHERE whale_score IS NOT NULL
                ORDER BY whale_score DESC
                LIMIT 1
              `
            );
            return rows.length > 0 ? rows[0].whale_score : null;
          } catch {
            return null;
          }
        })(),
      ]);

      const vwMetric = vwRows.length > 0 ? vwRows[0] : null;

      const prediction = fuseSignals(
        marketSlug,
        analysis,
        whaleStats != null ? { whaleScore: whaleStats, direction: analysis.direction } : null,
        analysis.topWallets.length > 0
          ? {
              behaviorType: analysis.whaleTradeCount >= 3 ? 'build' : null,
              side: analysis.direction === 'bullish' ? 'BUY'
                : analysis.direction === 'bearish' ? 'SELL'
                : 'UNKNOWN',
            }
          : null,
        vwMetric
          ? {
              vwDivergence: vwMetric.vwDivergence ?? 0,
              uai: vwMetric.uai ?? null,
              signalDirection: vwMetric.signalDirection ?? 'neutral',
              signalStrength: vwMetric.signalStrength ?? 0,
            }
          : null,
      );

      return cached({
        prediction,
        tier: plan,
      });
    }

    // Free tier: basic fusion
    const prediction = fuseBasicSignals(marketSlug, analysis);
    return cached({
      prediction,
      tier: 'free',
      upgradeHint: 'Upgrade to Pro for full fusion predictions with whale quality and VW analysis.',
    });

  } catch (err) {
    console.error('/api/prediction error', err);
    return cached({ error: 'Internal server error' }, { status: 500 });
  }
}
