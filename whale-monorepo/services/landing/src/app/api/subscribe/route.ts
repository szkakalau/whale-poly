import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

/**
 * POST /api/subscribe
 *
 * Proxies to the payment API's /checkout endpoint which creates a Stripe
 * Checkout Session. The user must be authenticated and provide a valid
 * Telegram activation code + plan slug.
 */
export async function POST(req: Request) {
  try {
    await requireUser();

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

    const activationCode = String(data.telegram_activation_code ?? '').trim();
    const plan = String(data.plan ?? '').trim().toLowerCase().replace('-', '_');

    if (!activationCode || !plan) {
      return NextResponse.json({ detail: 'telegram_activation_code and plan are required' }, { status: 400 });
    }

    const validPlans = new Set(['pro', 'elite', 'pro_yearly', 'elite_yearly', 'free']);
    if (!validPlans.has(plan)) {
      return NextResponse.json({ detail: 'invalid plan', allowed: Array.from(validPlans) }, { status: 400 });
    }

    const upstream = await fetch(`${base.replace(/\/$/, '')}/checkout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        telegram_activation_code: activationCode.toUpperCase(),
        plan,
      }),
      cache: 'no-store',
    });

    const ct = upstream.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const body = await upstream.json().catch(() => ({}));
      return NextResponse.json(body, { status: upstream.status });
    }

    // Non-JSON response — log but don't leak upstream body to client
    console.error('subscribe_upstream_non_json', { status: upstream.status, ct });
    return NextResponse.json({ detail: 'payment service temporarily unavailable' }, { status: 502 });
  } catch (e) {
    console.error('subscribe_error', e instanceof Error ? e.message : String(e));
    return NextResponse.json({ detail: 'internal server error' }, { status: 500 });
  }
}
