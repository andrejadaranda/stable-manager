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
