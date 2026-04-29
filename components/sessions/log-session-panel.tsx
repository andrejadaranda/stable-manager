"use client";

// Collapsible wrapper around LogSessionForm so the page leads with
// data, not a form. The "+ Log session" CTA expands it inline. Once
// expanded, the form behaves exactly as before — same persistence
// (localStorage last-pick), same validation, same submission flow.

import { useState } from "react";
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

  return (
    <div className="w-full md:w-[640px] max-w-full bg-white rounded-2xl shadow-soft p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-navy-900">Log session</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-ink-400 hover:text-navy-900 p-1 -mr-1 rounded-lg"
          aria-label="Collapse"
        >
          ✕
        </button>
      </div>
      <LogSessionForm horses={horses} clients={clients} />
    </div>
  );
}
