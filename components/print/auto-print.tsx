"use client";

import { useEffect } from "react";

/**
 * Triggers the browser's native print dialog on mount.
 *
 * Why a tiny client component instead of inline <script>:
 *   * Next.js App Router strips raw inline scripts in server components.
 *   * Putting this in its own file lets the parent stay a Server
 *     Component (so we still SSR the report itself — fast first paint
 *     even on slow data sets, no client-side fetch).
 *
 * The setTimeout(50) gives the browser a beat to paint everything so
 * the print preview shows the full content (Chrome on macOS otherwise
 * occasionally renders before fonts load).
 */
export function AutoPrint() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.setTimeout(() => {
      window.print();
    }, 50);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}

/**
 * Visible "Print / Save as PDF" trigger button. Lives in this file so
 * the surrounding export pages can stay Server Components — onClick
 * handlers are only legal in client components and Next 14 throws
 * "Event handlers cannot be passed to Client Component props" if a
 * server component renders <button onClick={…}>.
 */
export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined") window.print();
      }}
      className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm font-medium hover:bg-neutral-800"
    >
      {label}
    </button>
  );
}
