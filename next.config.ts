import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

// Mirrors next.config.js — see i18n/config.ts for why routing stays
// un-prefixed.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Security headers applied to every response from app.longrein.eu.
// Lighthouse "Best Practices" score and OWASP baseline both check these.
// HSTS preload is set after we're confident apex + subdomain are HTTPS-only
// for at least 60 days (avoid soft-locking ourselves out).
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options",    value: "nosniff" },
  { key: "X-Frame-Options",           value: "SAMEORIGIN" }, // anti-clickjacking
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // Modest CSP — allows inline styles (Tailwind/utility), Stripe + Supabase
  // origins explicitly. Tighten to nonce-based later when we have time to
  // audit every script tag. The current value still blocks the common XSS
  // attack vectors (foreign script loads, foreign frames).
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

const nextConfig: NextConfig = {
  // Preserve React strict-mode behaviour (was previously in next.config.js,
  // which is now deleted — Next loads .ts in preference to .js).
  reactStrictMode: true,
  // typedRoutes disabled — see matching comment in next.config.js.
  // Runs instrumentation.ts (Sentry server + edge init). Stable in Next
  // 15, so the flag goes away when this file becomes the canonical one.
  experimental: {
    instrumentationHook: true,
    // See next.config.js — @apm-js-collab/tracing-hooks is ESM-only and
    // Next 14's webpack can't bundle it. Renamed to
    // serverExternalPackages in Next 15.
    serverComponentsExternalPackages: ["@sentry/nextjs", "@sentry/node"],
  },
  images: {
    remotePatterns: [
      // Allow Supabase Storage public URLs
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
      // app.longrein.eu — noindex AUTHENTICATED + private routes ONLY.
      // PUBLIC routes (/signup*, /login, /s/*, /legal/*, /guest/*, root)
      // MUST be indexable so Google can rank them for brand + intent
      // queries and so public stable pages can surface in search.
      // Negative-lookahead matches everything that ISN'T a public path.
      {
        source: "/:path((?!signup|login|s/|legal/|guest/|_next/|favicon|apple-icon|icon\\.|manifest|robots|sitemap).*)",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
        has: [{ type: "host", value: "app.longrein.eu" }],
      },
    ];
  },
  async redirects() {
    return [
      // Founding-member demo booking — prospects click longrein.eu/demo
      // from outreach emails; we route them to Cal.eu without exposing
      // the Cal infra URL. 308 permanent so search + email clients cache it.
      {
        source: "/demo",
        destination: "https://cal.eu/longrein/demo",
        permanent: true,
      },
    ];
  },
};

// Mirrors the Sentry wrapping in next.config.js — see the longer comment
// there for why the tunnel route exists and why a missing auth token is
// not a build failure. Next 14 reads the .js file, so this is currently
// type-checking only; keep the two identical.
export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  tunnelRoute: "/monitoring",
  webpack: { treeshake: { removeDebugLogging: true } },
  sourcemaps: { deleteSourcemapsAfterUpload: true },
});
