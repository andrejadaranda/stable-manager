/**
 * Next.js config (CommonJS — Next 14.2.5 does NOT support next.config.ts).
 *
 * Production deploy 3guq3HXUa (commit 15ad6cf, 2026-05-22 19:51 UTC)
 * failed because next.config.js was deleted as "dead code", but
 * next.config.ts isn't actually loaded until Next 15. The .ts file
 * existed for editor type-checking but Next 14 was reading .js the
 * whole time. Bringing .js back as the canonical config.
 *
 * Keep this file and next.config.ts identical in behaviour. When we
 * upgrade to Next 15+, delete .js and let .ts take over.
 */

/** @type {import('next').NextConfig} */
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options",    value: "nosniff" },
  { key: "X-Frame-Options",           value: "SAMEORIGIN" },
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  {
    key:   "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://plausible.io https://*.vercel-analytics.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co https://longrein.eu",
      "connect-src 'self' https://*.supabase.co https://api.stripe.com https://app.longrein.eu https://plausible.io",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // typedRoutes was enabled but kept breaking the build on dynamic
  // href={string} patterns in shared components (FilterChip, sidebar,
  // settings layout, etc). The experimental flag costs us prod deploys
  // without enough type-safety upside to justify retro-fixing every
  // Link site under launch pressure. Revisit post-launch with a
  // coordinated Route<>typed-href migration if we want it back on.
  // experimental: { typedRoutes: true },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
        has: [{ type: "host", value: "app.longrein.eu" }],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/demo",
        destination: "https://cal.eu/longrein/demo",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
