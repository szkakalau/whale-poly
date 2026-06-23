import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware: sets x-html-lang header based on URL path.
 * Used by root layout to set <html lang> correctly for SEO + accessibility.
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const lang = pathname.startsWith('/blog/zh') ? 'zh' : 'en';

  const response = NextResponse.next();
  response.headers.set('x-html-lang', lang);
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|opengraph-image|icon.svg|favicon.ico).*)'],
};
