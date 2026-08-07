"use client";

// Root error boundary.
//
// Added as part of wiring the personal dashboard's error-rate card, which
// needed a source. It changes what every Longrein user sees when a page
// throws, so it is deliberately plain and dependency-free: no design
// system imports, no data fetching, nothing that could itself fail while
// rendering the thing that handles failures.
//
// Before this file existed an unhandled render error showed Next.js's
// default error screen and was recorded nowhere. This is strictly better
// on both counts.
//
// Note: a root error.tsx does NOT catch errors thrown by the root layout
// itself — that would need app/global-error.tsx. Those remain rare and
// still surface as the framework default.

import { useEffect } from "react";
import { reportClientError } from "@/app/personal/report-error";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void reportClientError({
      scope: "app",
      route: typeof window !== "undefined" ? window.location.pathname : undefined,
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#1C1A17",
      }}
    >
      <div style={{ maxWidth: "32rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
          Something went wrong
        </h1>
        <p style={{ marginTop: "0.75rem", color: "#7B7167", lineHeight: 1.6 }}>
          This page failed to load. The problem has been logged. Try again, or
          go back to your dashboard.
        </p>
        <div
          style={{
            marginTop: "1.5rem",
            display: "flex",
            gap: "0.75rem",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={reset}
            style={{
              borderRadius: "999px",
              border: "none",
              background: "#1E3A2A",
              color: "#fff",
              padding: "0.6rem 1.1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <a
            href="/dashboard"
            style={{
              borderRadius: "999px",
              border: "1px solid #DDD6CC",
              background: "#fff",
              color: "#1C1A17",
              padding: "0.6rem 1.1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Back to dashboard
          </a>
        </div>
        {error.digest && (
          <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "#A79C90" }}>
            Reference: {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
