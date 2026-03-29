import { NextResponse } from 'next/server';

const WHALE_ENGINE_BASE =
  process.env.NEXT_PUBLIC_WHALE_ENGINE_API_BASE_URL || 'https://whale-engine-api.onrender.com';

export async function GET(_: Request, context: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await context.params;
  const safeWallet = (wallet || '').trim();
  if (!safeWallet) {
    return NextResponse.json({ detail: 'wallet is required' }, { status: 400 });
  }

  const base = WHALE_ENGINE_BASE.replace(/\/$/, '');
  let upstream: Response;
  try {
    upstream = await fetch(`${base}/whales/${encodeURIComponent(safeWallet)}`, {
      cache: 'no-store',
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ detail: 'whale_engine_unreachable', error: message }, { status: 502 });
  }

  const body = await upstream.json().catch(() => ({}));
  return NextResponse.json(body, { status: upstream.status });
}
