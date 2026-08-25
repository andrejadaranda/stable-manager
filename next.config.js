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

const { withSentryConfig } = require("@sentry/nextjs");
const createNextIntlPlugin = require("next-intl/plugin");

// Points next-intl at the request config that resolves the locale. We use
// it WITHOUT locale-prefixed routing — see the long note in i18n/config.ts
// for why that matters here.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Runs instrumentation.ts, which is where Sentry's server and edge SDKs
  // get initialised. Stable in Next 15 — delete the flag (not the file)
  // at that upgrade.
  experimental: {
    instrumentationHook: true,
    // Sentry's Node SDK reaches for @apm-js-collab/tracing-hooks, which is
    // ESM-only. Next 14's webpack can't bundle that and compiles the whole
    // build "with warnings" unless the package is left external and
    // required at runtime instead. Next 15 renames this to
    // serverExternalPackages.
    serverComponentsExternalPackages: ["@sentry/nextjs", "@sentry/node"],
  },
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
      // app.longrein.eu — noindex AUTHENTICATED + private routes ONLY.
      // PUBLIC routes (/signup*, /login, /s/*, /legal/*, /, /guest/*)
      // must be indexable so Google can rank them for brand + intent
      // queries and so public stable pages can surface in search.
      //
      // Negative lookahead: match anything that DOESN'T start with one
      // of the public path roots. Equivalent of "noindex dashboard, api,
      // auth, invite, reset-password, live, but leave the rest alone".
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
      {
        source: "/demo",
        destination: "https://cal.eu/longrein/demo",
        permanent: true,
      },
    ];
  },
};

// Sentry wraps the config to compile the SDK in and (when a build-time
// auth token exists) upload source maps so stack traces name our files
// instead of chunk hashes.
//
// Without SENTRY_AUTH_TOKEN the plugin skips the upload and the build
// still succeeds — that is the state of every local build and of prod
// until the token is added in Vercel.
module.exports = withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only narrate the build in CI. Locally the plugin is chatty about the
  // missing auth token on every single `next build`.
  silent: !process.env.CI,

  // Route browser events through app.longrein.eu/monitoring instead of
  // straight to Sentry's ingest domain. Two reasons, both load-bearing:
  //
  //   1. The CSP in SECURITY_HEADERS has a tight connect-src. Tunnelling
  //      keeps the request same-origin, so 'self' already allows it and
  //      no third-party host has to be added to the policy.
  //   2. Ad blockers block requests to *.sentry.io by name. Without the
  //      tunnel a meaningful share of real users' errors never arrive.
  //
  // middleware.ts must keep excluding this path — see the matcher there.
  tunnelRoute: "/monitoring",

  // Strip Sentry's own console logging out of the client bundle.
  // (Was `disableLogger: true`, deprecated in @sentry/nextjs 10.)
  webpack: { treeshake: { removeDebugLogging: true } },

  // Don't leave source maps sitting in the deployed output after they've
  // been uploaded; they'd let anyone read our un-minified source.
  sourcemaps: { deleteSourcemapsAfterUpload: true },
});
