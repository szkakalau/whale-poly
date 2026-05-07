import { NextResponse } from 'next/server';
import { loadLiveSignals } from '@/lib/live-signals';
import { getCurrentUser } from '@/lib/auth';
import { filterLiveSignalsForUser, isPaidLiveSignalsUser } from '@/lib/live-signals-access';

export async function GET() {
  const [raw, user] = await Promise.all([loadLiveSignals(), getCurrentUser()]);
  const signals = filterLiveSignalsForUser(raw, user);
  const resp = NextResponse.json({ signals, source: 'whale_profiles+whale_engine', refreshedAt: new Date().toISOString() });
  if (user && isPaidLiveSignalsUser(user)) {
    resp.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=120');
  } else {
    resp.headers.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
  }
  return resp;
}

