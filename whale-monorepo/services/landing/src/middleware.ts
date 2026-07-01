import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware: sets security headers and x-html-lang for SEO.
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const lang = pathname.startsWith('/blog/zh') ? 'zh' : 'en';

  const response = NextResponse.next();
  response.headers.set('x-html-lang', lang);

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  );
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|opengraph-image|icon.svg|favicon.ico).*)'],
};
