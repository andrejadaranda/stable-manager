"use client";

// Collapsible wrapper around LogSessionForm so the page leads with
// data, not a form. The "+ Log session" CTA expands it inline. Once
// expanded, the form behaves exactly as before — same persistence
// (localStorage last-pick), same validation, same submission flow.

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LogSessionForm } from "./log-session-form";

type HorseOpt  = { id: string; name: string };
type ClientOpt = { id: string; full_name: string };

export function LogSessionPanel({
  horses,
  clients,
}: {
  horses: HorseOpt[];
  clients: ClientOpt[];
}) {
  const [open, setOpen] = useState(false);
  // Empty-state "Log past session" CTA links to ?new=1 — auto-open.
  const sp = useSearchParams();
  useEffect(() => {
    if (sp.get("new") === "1") setOpen(true);
  }, [sp]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="
          inline-flex items-center justify-center gap-1.5
          h-10 px-4 rounded-xl text-sm font-medium
          bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800
          transition-colors
        "
      >
        + Log session
      </button>
    );
  }

  // Open: full-screen sheet on mobile (so form fields have real width
  // instead of being squeezed into a parent flex action area), centered
  // dialog on desktop.
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-session-title"
      className="fixed inset-0 z-40 flex items-stretch sm:items-start sm:justify-center sm:pt-10 bg-ink-900/40 backdrop-blur-sm"
    >
      <div
        className="
          bg-white border border-ink-100 flex flex-col w-full
          h-[100dvh] sm:h-auto sm:max-h-[calc(100dvh-5rem)]
          sm:rounded-2xl sm:shadow-soft sm:max-w-2xl
        "
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-ink-100 shrink-0">
          <div>
            <h2 id="log-session-title" className="font-display text-xl text-navy-700 leading-tight">
              Log a session
            </h2>
            <p className="text-[12.5px] text-ink-500 mt-1 leading-relaxed">
              Every ride counts toward welfare workload. Sessions are not billed (lessons are).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="-mt-1 -mr-1 h-8 w-8 inline-flex items-center justify-center rounded-lg text-ink-500 hover:text-ink-900 hover:bg-ink-100/60 transition-colors"
          >
            <span aria-hidden className="text-base">✕</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <LogSessionForm horses={horses} clients={clients} />
        </div>
      </div>
    </div>
  );
}
