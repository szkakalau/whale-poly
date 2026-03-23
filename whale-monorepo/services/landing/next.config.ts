import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Keep output tracing root consistent with Turbopack root to avoid build warnings.
  outputFileTracingRoot: __dirname,
  // Prevent duplicate URL variants like `/blog` vs `/blog/` from being treated as separate pages.
  trailingSlash: false,
  outputFileTracingIncludes: {
    "/*": ["src/content/posts/**/*.md"],
  },
  async redirects() {
    return [
      // Consolidate thin duplicate vs Polymarket vs TradFi topic → single canonical article (SEO + AI citation).
      {
        source: "/blog/understanding-prediction-markets-vs-traditional-finance",
        destination: "/blog/polymarket-vs-traditional-trading-markets-differences",
        permanent: true,
      },
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
