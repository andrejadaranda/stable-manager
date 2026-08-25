// Sentry — Edge runtime.
//
// Loaded from instrumentation.ts when NEXT_RUNTIME === "edge". For
// Longrein that means middleware.ts, which runs on every request that
// isn't a static asset and refreshes the Supabase session cookie. A
// failure there logs everybody out, so it is worth reporting.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.SENTRY_ENV ?? process.env.NODE_ENV,

  // Middleware runs on literally every request. Sample it far more
  // sparingly than the app itself or it alone would exhaust the quota.
  tracesSampleRate: 0.01,

  sendDefaultPii: false,
});
