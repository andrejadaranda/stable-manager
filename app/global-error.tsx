"use client";

// Last-resort error boundary — catches errors thrown by the root layout
// itself, which app/error.tsx explicitly cannot (see the note at the top
// of that file).
//
// Because the failing layout never rendered, React has no <html> or
// <body> to attach to, so this component has to supply both. That is the
// one thing that makes global-error.tsx different from every other page
// in the app, and the reason it can't reuse the shared shell.
//
// Same discipline as app/error.tsx: no design-system imports, no data
// fetching, nothing that could throw while rendering the thing that
// handles throwing.

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    // No reportClientError() here. That helper posts to a server action
    // reached through the app shell — the very thing that just failed to
    // render. Sentry's transport is a plain fetch and doesn't care.
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#1C1A17",
          background: "#fff",
        }}
      >
        <div style={{ maxWidth: "32rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: "0.75rem", color: "#7B7167", lineHeight: 1.6 }}>
            Longrein failed to load. The problem has been logged and we are
            looking at it. Reloading usually helps.
          </p>
          <a
            href="/dashboard"
            style={{
              display: "inline-block",
              marginTop: "1.5rem",
              borderRadius: "999px",
              border: "none",
              background: "#1E3A2A",
              color: "#fff",
              padding: "0.6rem 1.1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Back to dashboard
          </a>
          {error.digest && (
            <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "#A79C90" }}>
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
