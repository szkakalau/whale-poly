import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

const ALERT_ENGINE_BASE =
  process.env.ALERT_ENGINE_API_BASE_URL || 'https://alert-engine-api.onrender.com';

export async function POST(req: Request) {
  await requireUser();
  let outcome = 'YES';
  try {
    const data = (await req.json()) as { outcome?: string };
    if (typeof data?.outcome === 'string' && data.outcome.trim()) {
      outcome = data.outcome.trim();
    }
  } catch {
    outcome = 'YES';
  }
  const params = new URLSearchParams({
    market_question: 'Telegram Outcome Test',
    outcome,
    side: 'buy',
    size: '1234.56',
    price: '0.9877',
    whale_score: '88',
  });
  const base = ALERT_ENGINE_BASE.replace(/\/$/, '');
  const url = `${base}/alerts/force?${params.toString()}`;
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) {
    return NextResponse.json({ detail: 'alert_engine_failed' }, { status: 502 });
  }
  const payload = await res.json().catch(() => ({}));
  return NextResponse.json({ ok: true, ...payload });
}
