// Sentry — browser SDK.
//
// Next 14 loads this file via the Sentry webpack plugin. Next 15.3+ moved
// to instrumentation-client.ts instead, so this file has to be renamed at
// that version bump; the same is true of the comment in next.config.js
// about .ts vs .js.
//
// Everything here is a no-op while NEXT_PUBLIC_SENTRY_DSN is unset, which
// is the state of every checkout until someone pastes a DSN in. init()
// with an undefined DSN disables the SDK rather than throwing, so the app
// behaves identically with and without Sentry configured. That property
// is deliberate — error monitoring must never be the reason a page fails.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? process.env.NODE_ENV,

  // Longrein is a small paid SaaS, not a traffic firehose. Sampling 10%
  // of transactions is enough to notice a route getting slow and keeps
  // us inside the free tier's quota with room to spare.
  tracesSampleRate: 0.1,

  // Session Replay stays OFF, and this is not a performance decision.
  //
  // Replay records the DOM of pages that show client names, guardian
  // contact details, children's lesson history and invoice amounts.
  // Shipping that to a third party is exactly the processing our privacy
  // policy says we don't do. Turning this on requires a DPA with Sentry
  // and a masking review first — not just flipping the number.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // No IP addresses, cookies or user identifiers attached automatically.
  // Same rule as lib/personal/error-log.ts: an error reporter is a very
  // easy way to accidentally build a personal-data store.
  sendDefaultPii: false,

  // Browser-extension and network noise that tells us nothing about
  // Longrein. Without this the free quota gets eaten by other people's
  // Chrome extensions throwing inside our page.
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "Non-Error promise rejection captured",
    /^Failed to fetch$/,
    /^NetworkError/,
    /^Load failed$/,
  ],
});
