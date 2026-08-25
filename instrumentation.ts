// Next.js instrumentation hook — the entry point Sentry's server and edge
// SDKs are initialised from.
//
// Next 14 only runs this file when experimental.instrumentationHook is
// true (see next.config.js). It became stable in Next 15; drop the flag,
// not this file, at that upgrade.
//
// The two configs are imported dynamically and per-runtime on purpose.
// A static import would pull the Node SDK into the edge bundle, where
// half of what it depends on doesn't exist.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Next 15+ calls this for errors thrown in server components, server
// actions and route handlers. Next 14 ignores it — on 14 those errors
// reach Sentry through the webpack-level wrapping the SDK already does.
// Exporting it now means the Next 15 upgrade needs no Sentry work.
export { captureRequestError as onRequestError } from "@sentry/nextjs";
