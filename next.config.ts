import type { NextConfig } from "next";

// Server-side only: where the Express API listens. The browser always calls the
// same-origin /api/v1 path, so session cookies stay first-party (and __Host- capable).
const API_URL = process.env.API_URL ?? "http://127.0.0.1:5000";

const securityHeaders = [
  // Script/style sources are left to Next's defaults; these directives are safe to
  // enforce without nonces. Tighten script-src with nonces when the app needs it.
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  // E2E runs its own server beside `npm run dev`; a separate build folder keeps their locks apart.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Stop `next dev` from writing AGENTS.md for AI coding agents.
  agentRules: false,
  experimental: {
    agentUpgrade: "security",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Fabrics are created from purchases now; the old Fabric Master address shows stock instead.
  async redirects() {
    return [{ source: "/fabric", destination: "/fabric/ledger", permanent: false }];
  },
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${API_URL}/api/v1/:path*` }];
  },
  async headers() {
    const hsts =
      process.env.NODE_ENV === "production"
        ? [
            {
              key: "Strict-Transport-Security",
              value: "max-age=63072000; includeSubDomains",
            },
          ]
        : [];
    return [{ source: "/:path*", headers: [...securityHeaders, ...hsts] }];
  },
};

export default nextConfig;
