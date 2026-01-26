import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const base = process.env.PAYMENT_API_BASE_URL;
  if (!base) {
    return NextResponse.json({ detail: 'PAYMENT_API_BASE_URL is required' }, { status: 500 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ detail: 'invalid json' }, { status: 400 });
  }

  const telegram_activation_code = String(payload?.telegram_activation_code || '').trim();
  const plan = String(payload?.plan || '').trim();
  if (!telegram_activation_code || !plan) {
    return NextResponse.json({ detail: 'telegram_activation_code and plan are required' }, { status: 400 });
  }

  const upstream = await fetch(`${base.replace(/\/$/, '')}/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ telegram_activation_code, plan }),
    cache: 'no-store'
  });

  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}

