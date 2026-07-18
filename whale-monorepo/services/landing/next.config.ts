import type { NextConfig } from "next";

/** Legacy marketing routes removed — send to home. */
const LEGACY_REDIRECTS: { source: string; destination?: string }[] = [
  { source: "/contact", destination: "/" },
  { source: "/backtesting", destination: "/" },
  { source: "/conviction", destination: "/" },
  { source: "/smart-money", destination: "/" },
  { source: "/follow", destination: "/" },
  { source: "/smart-collections", destination: "/" },
  { source: "/smart-collections/:path*", destination: "/" },
  { source: "/collections", destination: "/" },
  { source: "/collections/:path*", destination: "/" },
  { source: "/whales/:path*", destination: "/" },
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
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      ...LEGACY_REDIRECTS.map(({ source, destination }) => ({
        source,
        destination: destination ?? "/",
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
