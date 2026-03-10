import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  outputFileTracingIncludes: {
    "/*": ["src/content/posts/**/*.md"],
  },
  async redirects() {
    return [
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
