import { NextRequest, NextResponse } from 'next/server';
import { parseBearerToken, verifyMobileAccessToken } from './src/lib/mobileAuth';
import { verifyMiniAppSessionCookie } from './src/lib/telegramMiniApp';

const SESSION_COOKIE = 'tg_session';

function getSessionSecret(): string {
  // 仅使用专用的 TELEGRAM_MINIAPP_SECRET。
  // 回退到 BOT_TOKEN 是危险的 — Bot Token 在 Telegram 登录流程中暴露给客户端，
  // 攻击者获取后可伪造任意用户会话。
  const secret = process.env.TELEGRAM_MINIAPP_SECRET || '';
  if (!secret && (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production')) {
    console.error('FATAL: TELEGRAM_MINIAPP_SECRET is not set — sessions are insecure');
  }
  return secret;
}

export async function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.delete('x-user-id');

  const bearer = parseBearerToken(headers.get('authorization'));
  if (bearer) {
    const payload = await verifyMobileAccessToken(bearer);
    if (payload) {
      headers.set('x-user-id', payload.uid);
      return NextResponse.next({ request: { headers } });
    }
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.next({ request: { headers } });
  }

  const secret = getSessionSecret();
  if (!secret) {
    return NextResponse.next({ request: { headers } });
  }

  const payload = await verifyMiniAppSessionCookie(token, secret);
  if (!payload) {
    return NextResponse.next({ request: { headers } });
  }

  headers.set('x-user-id', payload.uid);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
