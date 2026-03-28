import { NextRequest, NextResponse } from 'next/server';
import { parseBearerToken, verifyMobileAccessToken } from './src/lib/mobileAuth';
import { verifyMiniAppSessionCookie } from './src/lib/telegramMiniApp';

const SESSION_COOKIE = 'tg_session';

function getSessionSecret(): string {
  return process.env.TELEGRAM_MINIAPP_SECRET || process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
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
  // Skip middleware for public blog routes (no `x-user-id` / auth) to reduce edge TTFB.
  // Match all paths except static assets and `/blog` + `/blog/*` (but not `/blogging`).
  matcher: ['/((?!blog(?:/|$)|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
