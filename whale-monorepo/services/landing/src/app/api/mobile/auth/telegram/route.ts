import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signMobileAccessToken } from '@/lib/mobileAuth';
import { verifyTelegramInitData } from '@/lib/telegramMiniApp';

function getBotToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
}

export async function POST(req: Request) {
  const botToken = getBotToken();
  if (!botToken) {
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
    auth = await verifyTelegramInitData(initData, botToken, 86400);
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

  let accessToken: string;
  try {
    accessToken = await signMobileAccessToken(user.id);
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'token_sign_failed';
    return NextResponse.json({ detail }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    accessToken,
    expiresIn: 60 * 60 * 24 * 7,
    user: {
      id: user.id,
      telegramId: user.telegramId,
      plan: user.plan,
      planExpireAt: user.planExpireAt?.toISOString() || null,
    },
  });
}
