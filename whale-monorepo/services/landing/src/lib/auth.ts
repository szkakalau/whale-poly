import { headers, cookies } from 'next/headers';
import { prisma } from './prisma';
import { verifyMiniAppSessionCookie } from './telegramMiniApp';
import type { MiniAppSessionPayload } from './telegramMiniApp';

export type AuthUser = {
  id: string;
  email: string;
  telegramId: string | null;
  plan: 'FREE' | 'PRO' | 'ELITE';
  planExpireAt: Date | null;
};

function getSessionSecret(): string {
  return process.env.TELEGRAM_MINIAPP_SECRET || process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
}

async function resolveUserId(): Promise<string | null> {
  // 1) Gateway-injected header (production reverse proxy).
  const hdrs = await headers();
  const gatewayUserId = hdrs.get('x-user-id');
  if (gatewayUserId) return gatewayUserId;

  // 2) Telegram Mini App session cookie (primary web auth).
  const secret = getSessionSecret();
  if (secret) {
    const jar = await cookies();
    const token = jar.get('tg_session')?.value;
    if (token) {
      const payload: MiniAppSessionPayload | null = await verifyMiniAppSessionCookie(token, secret);
      if (payload) return payload.uid;
    }
  }

  return null;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const userId = await resolveUserId();
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, telegramId: true, plan: true, planExpireAt: true },
  });
  if (!user) return null;

  return user;
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Response('Unauthorized', { status: 401 });
  }
  return user;
}
