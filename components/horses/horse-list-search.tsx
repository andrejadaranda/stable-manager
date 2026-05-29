"use client";

// Client-side instant search wrapper around <HorseList />.
//
// With 60+ horses the bare list becomes a wall of names — owners can't
// find Bella without scrolling. A debounced text filter on name/breed
// is the lowest-effort, highest-impact upgrade for that scale.
//
// Pagination not added yet — server-side load of 200 horses is still
// fine (~400ms). Add page=N querystring when stables cross 500.

import { useState, useMemo } from "react";
import type { HorseWithWeeklyWorkload } from "@/services/horses";
import { HorseList } from "./horse-list";

export function HorseListWithSearch({ horses }: { horses: HorseWithWeeklyWorkload[] }) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "retired">("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return horses.filter((h) => {
      // Status filter
      if (statusFilter === "active"  && !h.active) return false;
      if (statusFilter === "retired" &&  h.active) return false;
      // Search: name OR breed substring match
      if (!needle) return true;
      if (h.name?.toLowerCase().includes(needle)) return true;
      if (h.breed?.toLowerCase().includes(needle)) return true;
      return false;
    });
  }, [horses, q, statusFilter]);

  return (
    <div className="flex flex-col gap-4">
      {/* Chips above, search below — unified pattern with clients page. */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "active", "retired"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`h-9 inline-flex items-center gap-2 px-3.5 rounded-full text-[12.5px] font-medium transition-colors ${
              statusFilter === s
                ? "bg-brand-700 text-white shadow-sm"
                : "bg-white text-ink-700 hover:bg-ink-100/60 ring-1 ring-ink-200"
            }`}
          >
            {s === "all" ? "All" : s === "active" ? "Active" : "Retired"}
          </button>
        ))}
      </div>
      <div className="relative">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${horses.length} horse${horses.length === 1 ? "" : "s"} by name or breed…`}
          className="
            w-full h-10 pl-10 pr-3 rounded-xl border border-ink-200
            text-sm bg-white text-ink-900 placeholder:text-ink-400
            focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
          "
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none"
          viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
      </div>

      {(q.trim() || statusFilter !== "all") && (
        <p className="text-[12px] text-ink-500 -mt-1.5">
          Showing {filtered.length} of {horses.length}
        </p>
      )}

      <HorseList horses={filtered} />
    </div>
  );
}
