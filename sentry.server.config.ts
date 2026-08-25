// Sentry — Node.js server runtime.
//
// Loaded from instrumentation.ts when NEXT_RUNTIME === "nodejs". Covers
// server components, server actions and the API route handlers under
// app/api (including the Stripe webhook, which is the one place where a
// silent failure costs real money).
//
// SENTRY_DSN is server-only and preferred; NEXT_PUBLIC_SENTRY_DSN is the
// fallback so a single env var is enough to switch monitoring on. As on
// the client, an unset DSN disables the SDK rather than throwing.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.SENTRY_ENV ?? process.env.NODE_ENV,

  tracesSampleRate: 0.1,

  // See sentry.client.config.ts — no automatic PII. On the server this
  // matters more, not less: request bodies here contain client records,
  // invoice lines and Stripe customer data.
  sendDefaultPii: false,
});
