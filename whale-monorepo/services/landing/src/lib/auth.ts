import { headers, cookies } from 'next/headers';
import { prisma } from './prisma';
import { verifyMiniAppSessionCookie } from './telegramMiniApp';
import { verifyMobileAccessToken } from './mobileAuth';
import type { MiniAppSessionPayload } from './telegramMiniApp';

export type AuthUser = {
  id: string;
  email: string;
  telegramId: string | null;
  plan: 'FREE' | 'PRO' | 'ELITE';
  planExpireAt: Date | null;
};

/**
 * Session signing secret. Uses exactly one env var — no fallback chain.
 * A fallback chain ending in '' means unconfigured deployments have forgeable sessions.
 */
function getSessionSecret(): string {
  const secret = process.env.TELEGRAM_MINIAPP_SECRET || '';
  if (!secret && process.env.NODE_ENV === 'production') {
    console.error('FATAL: TELEGRAM_MINIAPP_SECRET is not set — sessions are insecure');
  }
  return secret;
}

async function resolveUserId(): Promise<string | null> {
  const hdrs = await headers();

  // 1) Gateway-injected header (production reverse proxy).
  //    Only trusted when X-Internal-Secret matches the configured value.
  const gatewayUserId = hdrs.get('x-user-id');
  if (gatewayUserId) {
    const internalSecret = process.env.INTERNAL_GATEWAY_SECRET;
    if (internalSecret && hdrs.get('x-internal-secret') === internalSecret) {
      return gatewayUserId;
    }
    // Without the internal secret, fall through to cookie/ Bearer auth
  }

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

  // 3) Mobile Bearer token (Android app).
  const authHeader = hdrs.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = await verifyMobileAccessToken(token);
    if (payload?.uid) return payload.uid;
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
