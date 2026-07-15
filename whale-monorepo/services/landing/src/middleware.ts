import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware: security headers (pages) + CSRF protection (API mutation routes).
 */

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const PRODUCTION_HOST = 'www.sightwhale.com';
const ALLOWED_ORIGINS = new Set([
  'https://www.sightwhale.com',
  'https://sightwhale.com',
]);

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  // Development: allow localhost origins
  if (process.env.NODE_ENV !== 'production') {
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return true;
    }
  }
  return ALLOWED_ORIGINS.has(origin);
}

/**
 * CSRF check for API mutation routes.
 * Relies on browser-enforced Origin header (cannot be forged by cross-origin JS).
 * Routes with their own token-based auth (e.g. x-alert-token) can add themselves
 * to CSRF_SKIP_PATHS to opt out.
 */
const CSRF_SKIP_PATHS = new Set([
  '/api/alerts',       // token-based auth via x-alert-token
  '/api/mobile',       // Bearer token auth
  '/api/tg',           // Telegram initData auth
  '/api/blog',         // proxy endpoint
]);

function validateCsrf(request: NextRequest): Response | null {
  const method = request.method.toUpperCase();
  if (!MUTATION_METHODS.has(method)) return null;

  const pathname = request.nextUrl.pathname;
  for (const skip of CSRF_SKIP_PATHS) {
    // Exact match or prefix with trailing slash only (not substring)
    if (pathname === skip || pathname.startsWith(skip + '/')) return null;
  }

  // SameSite=Lax cookies are NOT sent on cross-origin POST via fetch/form.
  // This check provides defense-in-depth for browsers that don't support SameSite.
  const origin = request.headers.get('origin') || '';
  if (isAllowedOrigin(origin)) return null;

  // Allow requests with no Origin header (server-to-server, native apps)
  // when an Authorization or x-alert-token header is present.
  if (!origin) {
    if (request.headers.get('authorization') || request.headers.get('x-alert-token')) {
      return null;
    }
  }

  return NextResponse.json({ detail: 'csrf_origin_mismatch' }, { status: 403 });
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // API routes — CSRF protection only
  if (pathname.startsWith('/api/')) {
    const csrfBlock = validateCsrf(request);
    if (csrfBlock) return csrfBlock;
    return NextResponse.next();
  }

  // Page routes — security headers

  // Redirect /blog/:slug (missing language prefix) → /blog/en/:slug
  // Fixes 404s from 74 hardcoded internal links in content markdown + old Google-indexed URLs
  if (pathname.startsWith('/blog/') && !pathname.startsWith('/blog/feed.xml')) {
    const segments = pathname.split('/').filter(Boolean); // ['blog', 'slug'] or ['blog', 'lang', 'rest']
    if (segments.length === 2 && segments[1] !== 'en' && segments[1] !== 'zh') {
      const url = request.nextUrl.clone();
      url.pathname = `/blog/en/${segments[1]}`;
      return NextResponse.redirect(url, 308);
    }
  }

  const lang = pathname.startsWith('/blog/zh') ? 'zh' : 'en';
  const response = NextResponse.next();
  response.headers.set('x-html-lang', lang);

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload',
  );
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  );
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.vercel-insights.com https://*.vercel-analytics.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://gamma-api.polymarket.com https://data-api.polymarket.com https://*.onrender.com https://*.vercel-insights.com https://*.vercel-analytics.com",
      "frame-src 'self' https://checkout.stripe.com",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; '),
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - opengraph-image, icon.svg, favicon.ico (static assets)
     */
    '/((?!_next/static|_next/image|opengraph-image|icon.svg|favicon.ico).*)',
  ],
};
