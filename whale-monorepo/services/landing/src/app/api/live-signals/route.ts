import { NextResponse } from 'next/server';
import { loadLiveSignals } from '@/lib/live-signals';

export async function GET() {
  const signals = await loadLiveSignals();
  const resp = NextResponse.json({ signals, source: 'whale_profiles+whale_engine', refreshedAt: new Date().toISOString() });
  resp.headers.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
  return resp;
}

