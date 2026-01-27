import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const base = process.env.PAYMENT_API_BASE_URL;
  if (!base) {
    return NextResponse.json({ detail: 'PAYMENT_API_BASE_URL is required' }, { status: 500 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ detail: 'invalid json' }, { status: 400 });
  }

  const data = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};
  const telegram_activation_code = String(data.telegram_activation_code ?? '').trim();
  const plan = String(data.plan ?? '').trim();
  if (!telegram_activation_code || !plan) {
    return NextResponse.json({ detail: 'telegram_activation_code and plan are required' }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${base.replace(/\/$/, '')}/checkout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ telegram_activation_code, plan }),
      cache: 'no-store'
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ detail: 'payment api unreachable', error: message }, { status: 502 });
  }

  const ct = upstream.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  }

  const text = await upstream.text().catch(() => '');
  return NextResponse.json({ detail: 'payment api returned non-json', status: upstream.status, body: text.slice(0, 500) }, { status: 502 });
}
