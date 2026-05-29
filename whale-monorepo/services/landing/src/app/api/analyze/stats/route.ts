/**
 * GET /api/analyze/stats — lightweight usage stats for the decision engine.
 * In-memory counters, resets on cold start.
 */
import { NextResponse } from 'next/server';
import { getAnalyzeStats } from '@/lib/analyze-analytics';

export async function GET() {
  return NextResponse.json(getAnalyzeStats());
}
