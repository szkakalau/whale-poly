import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signMiniAppSessionCookie, verifyTelegramInitData } from '@/lib/telegramMiniApp';

const SESSION_COOKIE = 'tg_session';

function getBotToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
}

/**
 * Session signing secret — single env var, no fallback chain.
 * Must match the secret used by auth.ts for verification.
 */
function getSessionSecret(): string {
  const secret = process.env.TELEGRAM_MINIAPP_SECRET || '';
  if (!secret && process.env.NODE_ENV === 'production') {
    console.error('FATAL: TELEGRAM_MINIAPP_SECRET is not set — sessions are insecure');
  }
  return secret;
}

export async function POST(req: Request) {
  const botToken = getBotToken();
  const sessionSecret = getSessionSecret();
  if (!botToken || !sessionSecret) {
    return NextResponse.json({ detail: 'server_not_configured' }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: 'invalid_json' }, { status: 400 });
  }

  const initData =
    body && typeof body === 'object' && 'initData' in body ? (body as { initData?: string }).initData : '';
  if (!initData || typeof initData !== 'string') {
    return NextResponse.json({ detail: 'missing_initData' }, { status: 400 });
  }

  let auth;
  try {
    auth = await verifyTelegramInitData(initData, botToken, 300);
  } catch (e) {
    const code = e instanceof Error ? e.message : 'invalid_initData';
    return NextResponse.json({ detail: code }, { status: 401 });
  }

  const telegramId = String(auth.user.id);
  const syntheticEmail = `tg_${telegramId}@telegram.local`;

  const user = await prisma.user.upsert({
    where: { telegramId },
    update: {},
    create: {
      telegramId,
      email: syntheticEmail,
    },
    select: { id: true, telegramId: true, plan: true, planExpireAt: true },
  });

  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  const cookieValue = await signMiniAppSessionCookie({ uid: user.id, tid: telegramId, exp }, sessionSecret);

  const res = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      telegramId: user.telegramId,
      plan: user.plan,
      planExpireAt: user.planExpireAt?.toISOString() || null,
    },
  });

  res.cookies.set({
    name: SESSION_COOKIE,
    value: cookieValue,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}
