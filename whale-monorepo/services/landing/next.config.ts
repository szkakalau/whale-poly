import type { NextConfig } from "next";

/**
 * Legacy marketing routes — redirect to the most semantically relevant page.
 *
 * First-principles rule: a redirect to `/` destroys ALL link equity and sends
 * zero relevance signal. Every redirect target below is the closest existing
 * page to the original URL's intent, so Google passes PageRank through and
 * users land somewhere useful instead of a generic homepage.
 */
const LEGACY_REDIRECTS: { source: string; destination: string }[] = [
  // Core product concepts → nearest matching feature pages
  { source: "/conviction", destination: "/volume-analysis" },   // conviction signals
  { source: "/smart-money", destination: "/history" },          // whale trade history
  // Removed features → home (no semantically close page exists)
  { source: "/contact", destination: "/" },
  { source: "/follow", destination: "/" },
  { source: "/smart-collections", destination: "/" },
  { source: "/smart-collections/:path*", destination: "/" },
  { source: "/collections", destination: "/" },
  { source: "/collections/:path*", destination: "/" },
  { source: "/whales/:path*", destination: "/" },
  // Removed info pages → home
  { source: "/editorial-policy", destination: "/" },
  { source: "/disclosures", destination: "/" },
  { source: "/security", destination: "/" },
  { source: "/whale-waitlist", destination: "/" },
  { source: "/tg", destination: "/" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: __dirname,
  },
  outputFileTracingRoot: __dirname,
  trailingSlash: false,
  async headers() {
    return [
      // ── Public content: defense-in-depth index signal ──────────────
      // Google respects both <meta name="robots"> AND the X-Robots-Tag HTTP
      // header. Vercel preview deployments inject `X-Robots-Tag: noindex` by
      // default. If a misconfiguration ever leaks that to production, this
      // explicit header overrides it for every public page.
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Robots-Tag', value: 'index, follow' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      // ── Transactional pages: MUST stay out of search indices ───────
      // These are Stripe checkout return URLs — zero value for search users.
      // More-specific routes take precedence over the catch-all above.
      {
        source: '/cancel',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/success',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
  async redirects() {
    return [
      ...LEGACY_REDIRECTS.map(({ source, destination }) => ({
        source,
        destination,
        permanent: true,
      })),
      {
        source: "/:path*",
        has: [{ type: "header", key: "x-forwarded-proto", value: "http" }],
        destination: "https://www.sightwhale.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "sightwhale.com" }],
        destination: "https://www.sightwhale.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
