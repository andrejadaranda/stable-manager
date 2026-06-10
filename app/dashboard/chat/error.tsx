"use client";

// Chat-route error boundary. Instead of the generic blanket "Application
// error: a client-side exception", surface the real message + digest so a
// crash here is diagnosable (and recoverable via Try again). Scoped to the
// chat route only — other pages keep the global boundary.

import { useEffect } from "react";

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Shows up in the browser console and Vercel logs.
    console.error("[chat] route error:", error);
  }, [error]);

  return (
    <div className="flex flex-col gap-6">
      <div className="card-elevated p-6 max-w-xl">
        <h1 className="text-lg font-semibold text-ink-900">Chat hit an error</h1>
        <p className="text-sm text-ink-600 mt-2">
          Something went wrong loading the chat. The details below help us fix it.
        </p>
        <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-ink-50 p-3 text-[12px] text-rose-700">
          {error?.message || "Unknown error"}
          {error?.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="text-[13px] text-white bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-lg font-medium"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="text-[13px] text-ink-700 hover:text-ink-900 px-4 py-2 rounded-lg border border-ink-200"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
