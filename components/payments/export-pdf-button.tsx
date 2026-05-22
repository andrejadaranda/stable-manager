"use client";

import { useState } from "react";

type Props = {
  /** Where the print view lives. /dashboard/payments/export or /dashboard/expenses/export. */
  basePath: "/dashboard/payments/export" | "/dashboard/expenses/export";
  /** Default "from" date when the panel opens. */
  defaultFrom?: string; // YYYY-MM-DD
  /** Default "to" date. */
  defaultTo?: string;   // YYYY-MM-DD
};

/**
 * Inline date-range picker that opens a print-ready report in a new
 * tab. The new tab auto-fires `window.print()`; the user picks "Save
 * as PDF" in the browser print dialog and gets a clean A4 document.
 *
 * Why new tab instead of a modal print iframe:
 *   * Mobile Safari blocks programmatic print inside an iframe.
 *   * A real tab gives the owner the option to keep the report open
 *     side-by-side with the dashboard (common when reconciling).
 *   * No layout-shift on the calling page.
 */
export function ExportPdfButton({
  basePath,
  defaultFrom,
  defaultTo,
}: Props) {
  const [open, setOpen] = useState(false);
  const today = ymd(new Date());
  const monthStart = ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const [from, setFrom] = useState(defaultFrom ?? monthStart);
  const [to,   setTo]   = useState(defaultTo   ?? today);

  function openReport() {
    if (!from || !to) return;
    if (from > to) return;
    const url = `${basePath}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-neutral-300 bg-white text-neutral-800 px-3 py-2 text-sm font-medium hover:bg-neutral-50 flex items-center gap-1.5"
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Export PDF
      </button>

      {open && (
        <>
          {/* Backdrop closes the popover when clicking outside */}
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-20"
            aria-hidden="true"
          />
          <div className="absolute right-0 top-full mt-2 z-30 w-72 rounded-md border border-neutral-200 bg-white shadow-lg p-4 flex flex-col gap-3">
            <p className="text-xs text-neutral-500">
              Pick a date range. The report opens in a new tab and the print
              dialog appears automatically — pick &quot;Save as PDF&quot;.
            </p>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-700">From</span>
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.currentTarget.value)}
                className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-700">To</span>
              <input
                type="date"
                value={to}
                min={from}
                max={today}
                onChange={(e) => setTo(e.currentTarget.value)}
                className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
              />
            </label>

            <div className="flex flex-wrap gap-1.5">
              <QuickRange label="This month" onClick={() => setQuickRange("month", setFrom, setTo)} />
              <QuickRange label="Last month" onClick={() => setQuickRange("last-month", setFrom, setTo)} />
              <QuickRange label="Last 30 days" onClick={() => setQuickRange("30d", setFrom, setTo)} />
              <QuickRange label="This year" onClick={() => setQuickRange("year", setFrom, setTo)} />
            </div>

            <button
              type="button"
              onClick={openReport}
              disabled={!from || !to || from > to}
              className="mt-1 w-full rounded-md bg-neutral-900 text-white py-2 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Open report
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function QuickRange({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs px-2 py-1 rounded border border-neutral-200 hover:bg-neutral-50 text-neutral-700"
    >
      {label}
    </button>
  );
}

type RangeKey = "month" | "last-month" | "30d" | "year";

function setQuickRange(
  range: RangeKey,
  setFrom: (s: string) => void,
  setTo: (s: string) => void,
) {
  const now = new Date();
  if (range === "month") {
    setFrom(ymd(new Date(now.getFullYear(), now.getMonth(), 1)));
    setTo(ymd(now));
  } else if (range === "last-month") {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last  = new Date(now.getFullYear(), now.getMonth(), 0);
    setFrom(ymd(first));
    setTo(ymd(last));
  } else if (range === "30d") {
    const start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    setFrom(ymd(start));
    setTo(ymd(now));
  } else if (range === "year") {
    setFrom(ymd(new Date(now.getFullYear(), 0, 1)));
    setTo(ymd(now));
  }
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
