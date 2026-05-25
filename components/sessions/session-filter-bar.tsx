"use client";

// Client-side filter pills for the Sessions list.
// Pure UI — wraps SessionList with filter state, slices the array,
// renders. No round-trip to server, no URL state.
//
// IMPORTANT (BUG #Y fix): cannot use a render-prop children pattern
// here — passing a function from a Server Component to a Client
// Component violates the Next.js serialization boundary. Instead this
// component imports SessionList directly and renders the filtered
// subset itself. SessionList is plain JSX (no server IO) so this is
// safe; the only client-only piece inside is DeleteSessionButton
// which already has its own "use client" directive.

import { useMemo, useState } from "react";
import type { SessionWithLabels } from "@/services/sessions";
import { SessionList } from "./session-list";

type Range = "week" | "month" | "90d" | "all";

const RANGE_LABEL: Record<Range, string> = {
  week:  "This week",
  month: "This month",
  "90d": "90 days",
  all:   "All time",
};

const RANGE_DAYS: Record<Range, number | null> = {
  week:   7,
  month:  30,
  "90d":  90,
  all:    null,
};

export function SessionFilterBar({
  sessions,
  canDelete,
}: {
  sessions: SessionWithLabels[];
  canDelete?: boolean;
}) {
  const [range, setRange] = useState<Range>("90d");
  const [horseId, setHorseId] = useState<string>("");
  const [type, setType] = useState<string>("");

  // Unique horse + type options pulled from the visible session set.
  const horseOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sessions) {
      if (s.horse) m.set(s.horse.id, s.horse.name);
    }
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [sessions]);

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) set.add(s.type);
    return Array.from(set).sort();
  }, [sessions]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoffMs = RANGE_DAYS[range] != null
      ? now - RANGE_DAYS[range]! * 86_400_000
      : 0;
    return sessions.filter((s) => {
      if (cutoffMs > 0 && new Date(s.started_at).getTime() < cutoffMs) return false;
      if (horseId && s.horse?.id !== horseId) return false;
      if (type && s.type !== type) return false;
      return true;
    });
  }, [sessions, range, horseId, type]);

  const activeFilters = (horseId ? 1 : 0) + (type ? 1 : 0) + (range !== "90d" ? 1 : 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Filter pills + selects */}
      <div className="flex flex-wrap items-center gap-2 bg-white/60 border border-ink-100 rounded-xl px-3 py-2">
        {/* Range pills */}
        <div className="flex gap-1">
          {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                range === r
                  ? "bg-brand-600 text-white"
                  : "bg-transparent text-ink-700 hover:bg-ink-100"
              }`}
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-ink-100 mx-1" />

        {/* Horse facet */}
        {horseOptions.length > 0 && (
          <select
            value={horseId}
            onChange={(e) => setHorseId(e.target.value)}
            className="h-8 px-2 rounded-lg text-xs bg-white border border-ink-200 text-ink-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            <option value="">All horses</option>
            {horseOptions.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        )}

        {/* Type facet */}
        {typeOptions.length > 0 && (
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-8 px-2 rounded-lg text-xs bg-white border border-ink-200 text-ink-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            <option value="">All types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
        )}

        {activeFilters > 0 && (
          <button
            type="button"
            onClick={() => { setRange("90d"); setHorseId(""); setType(""); }}
            className="ml-auto h-8 px-2 rounded-lg text-xs text-ink-500 hover:text-ink-900 transition-colors"
          >
            Reset
          </button>
        )}

        <span className="ml-auto text-[11px] text-ink-500 tabular-nums">
          {filtered.length} of {sessions.length}
        </span>
      </div>

      {/* Filtered list — or "no matches" hint if the filter shrunk to zero */}
      {filtered.length === 0 && sessions.length > 0 ? (
        <div className="bg-cream-50 border border-ink-100 rounded-2xl px-6 py-8 text-center">
          <p className="text-sm font-medium text-ink-700">No sessions match your filters.</p>
          <p className="text-xs text-ink-500 mt-1.5">Try widening the date range or clearing facets.</p>
        </div>
      ) : (
        <SessionList sessions={filtered} canDelete={canDelete} />
      )}
    </div>
  );
}
