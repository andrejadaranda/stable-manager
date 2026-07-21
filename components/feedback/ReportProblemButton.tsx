"use client";

// Floating "Report a problem" widget — Founding 15 launch insurance.
// Bottom-right pill, single click → modal → submit → email lands in
// hello@longrein.eu (or wherever FEEDBACK_TO_EMAIL points).
//
// Used inside the dashboard layout, so it's always visible to signed-in
// users without polluting marketing/login pages.

import { useEffect, useState } from "react";

type Status = "idle" | "sending" | "sent" | "error";

export function ReportProblemButton() {
  const [open, setOpen]       = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus]   = useState<Status>("idle");
  const [errorMsg, setError]  = useState<string | null>(null);

  // Close modal on Escape for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setStatus("sending");
    setError(null);

    try {
      const res = await fetch("/api/feedback/submit", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          page:       typeof window !== "undefined" ? window.location.href  : null,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        }),
      });
      const body = await res.json().catch(() => ({} as { ok?: boolean; error?: string }));
      if (!res.ok || !body.ok) {
        throw new Error(body.error ?? "Couldn't send your report. Try again.");
      }
      setStatus("sent");
      setMessage("");
      // Auto-close after 2.5s so the user sees the confirmation but doesn't
      // have to dismiss it themselves.
      setTimeout(() => {
        setOpen(false);
        setStatus("idle");
      }, 2500);
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    }
  }

  return (
    <>
      {/* Floating button — only rendered when modal is closed.
         Mobile (< sm = 640px): icon-only, smaller, anchored bottom-left to
         avoid covering primary FAB-style CTAs (Create lesson, Save changes,
         etc.) which are typically bottom-right on mobile pages. Adds
         safe-area-inset-bottom for iOS home indicator.
         Desktop (≥ sm): full pill with label, bottom-right as before. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="
            fixed z-30 rounded-full bg-brand-700 hover:bg-brand-600 text-surface
            shadow-lift transition-colors inline-flex items-center justify-center gap-2
            font-medium
            bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3
            h-11 w-11 text-base
            sm:bottom-5 sm:right-5 sm:left-auto sm:h-auto sm:w-auto sm:px-4 sm:py-2.5 sm:text-sm
          "
          aria-label="Report a problem"
          title="Report a problem"
        >
          <span aria-hidden>💬</span>
          <span className="hidden sm:inline">Report a problem</span>
        </button>
      )}

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Report a problem"
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-lift p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="font-serif text-lg font-semibold text-brand-700 tracking-tightest">
                  Report a problem
                </h2>
                <p className="text-[13px] text-ink-500 mt-1 leading-relaxed">
                  Tell us what went wrong. We read every report — usually within the hour.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-ink-400 hover:text-ink-700 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {status === "sent" ? (
              <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
                Thank you — it&rsquo;s on its way. We&rsquo;ll reply to your stable email if needed.
              </div>
            ) : (
              <form onSubmit={onSubmit} className="flex flex-col gap-3">
                <textarea
                  name="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  required
                  maxLength={4000}
                  autoFocus
                  placeholder="What happened? Include the steps you took if you can."
                  className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-3 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 resize-y"
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] text-ink-500 italic">
                    We&rsquo;ll include the page you&rsquo;re on right now.
                  </p>
                  <button
                    type="submit"
                    disabled={status === "sending" || !message.trim()}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-700 hover:bg-brand-600 disabled:opacity-60 disabled:cursor-not-allowed text-surface px-5 py-2 text-sm font-medium transition-colors"
                  >
                    {status === "sending" ? "Sending…" : "Send report"}
                  </button>
                </div>
                {errorMsg && (
                  <p className="text-[13px] text-rose-700 mt-1">{errorMsg}</p>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
