/**
 * Server-side persistence + live calibration data for the prediction model.
 *
 * Kept separate from prediction-model.ts (pure math, unit-tested without a DB)
 * so the training code stays deterministic and testable.
 */

import { prisma } from '@/lib/prisma';
import type { ProbabilityModel } from '@/lib/prediction-model';

const API_BASE = process.env.TRADE_INGEST_API_URL || 'https://sightwhale.onrender.com';

/** Load the most recently persisted trained model, or null if none exists. */
export async function loadPersistedModel(): Promise<ProbabilityModel | null> {
  try {
    const row = await prisma.predictionModel.findFirst({
      orderBy: { trainedAt: 'desc' },
    });
    if (!row) return null;
    return {
      intercept: row.intercept,
      scoreCoef: row.scoreCoef,
      bullishCoef: row.bullishCoef,
      bearishCoef: 0, // implied by bullishCoef (dummy variable trap)
      trainedAt: row.trainedAt.toISOString(),
      sampleSize: row.sampleSize,
      accuracy: row.accuracy,
    };
  } catch (err) {
    console.error('[prediction-model-store] loadPersistedModel failed:', err);
    return null;
  }
}

/** Persist a freshly trained model and return its version number. */
export async function savePersistedModel(model: ProbabilityModel): Promise<number> {
  const latest = await prisma.predictionModel.findFirst({
    orderBy: { trainedAt: 'desc' },
    select: { version: true },
  });
  const version = (latest?.version ?? 0) + 1;
  const row = await prisma.predictionModel.create({
    data: {
      version,
      intercept: model.intercept,
      scoreCoef: model.scoreCoef,
      bullishCoef: model.bullishCoef,
      sampleSize: model.sampleSize,
      accuracy: model.accuracy,
      trainedAt: new Date(model.trainedAt),
    },
  });
  return row.version;
}

export type TierWinRates = Record<'90–100' | '80–89' | '70–79' | '<70', number>;

/**
 * Live per-tier win rates computed from settled signals (the public
 * calibration data served by /stats/home). No hardcoded win rates — the
 * numbers come from the actual, continuously updated calibration table.
 * Falls back to the neutral 0.5 prior when the backend is unavailable.
 */
export async function fetchTierWinRates(): Promise<TierWinRates> {
  const neutral: TierWinRates = { '90–100': 0.5, '80–89': 0.5, '70–79': 0.5, '<70': 0.5 };
  try {
    const res = await fetch(`${API_BASE}/stats/home`, {
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: 300 },
    });
    if (!res.ok) return neutral;
    const data = (await res.json()) as {
      scoreTiers?: { tier: string; winRate: number | null; resolvedCount: number }[];
    };
    const out = { ...neutral };
    for (const t of data.scoreTiers ?? []) {
      // Ignore statistically meaningless bands (very small settled counts).
      if (t.winRate == null || (t.resolvedCount ?? 0) < 20) continue;
      const win = Math.min(1, Math.max(0, t.winRate));
      if (t.tier === 'elite') out['90–100'] = win;
      else if (t.tier === 'high') out['80–89'] = win;
      else if (t.tier === 'med') out['70–79'] = win;
      else if (t.tier === 'base') out['<70'] = win;
    }
    return out;
  } catch (err) {
    console.error('[prediction-model-store] fetchTierWinRates failed:', err);
    return neutral;
  }
}
