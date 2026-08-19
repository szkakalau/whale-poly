/**
 * GET /api/prediction/model — public transparency endpoint.
 *
 * Returns the currently persisted logistic-regression calibration model
 * (coefficients, sample size, accuracy, trainedAt). This makes the
 * probability model auditable: anyone can see exactly what coefficients
 * drive P(correct | score, direction).
 */

import { NextResponse } from 'next/server';
import { loadPersistedModel } from '@/lib/prediction-model-store';

export async function GET() {
  const model = await loadPersistedModel();
  if (!model) {
    return NextResponse.json(
      {
        model: null,
        note: 'No persisted model yet. The first /api/prediction request with sufficient backtest data trains and persists one automatically.',
      },
      {
        headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=300' },
      },
    );
  }
  return NextResponse.json(
    {
      model,
      // Human-readable formula for full transparency.
      formula: 'P(correct) = sigmoid(intercept + scoreCoef·(score/100) + bullishCoef·isBullish)',
    },
    {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=300' },
    },
  );
}
