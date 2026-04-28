// Sessions tab — list grouped by day with an Add session FAB.
// Phase 2 adds the quick-add sheet (4-field flow) plus inline notes
// (handled per-row in SessionRow).

import type { SessionWithLabels, SessionType } from "@/services/sessions";
import { AddSessionFAB } from "./AddSessionSheet";
import { SessionNoteEditor } from "./SessionNoteEditor";

type ClientOpt = { id: string; full_name: string };

const TYPE_LABEL: Record<SessionType, string> = {
  flat: "Flat",
  jumping: "Jumping",
  lunging: "Lunging",
  groundwork: "Groundwork",
  hack: "Hack",
  other: "Other",
};

const TYPE_TONE: Record<SessionType, { bg: string; fg: string }> = {
  flat:       { bg: "#FAECE7", fg: "#993C1D" },
  jumping:    { bg: "#FAEEDA", fg: "#854F0B" },
  hack:       { bg: "#EAF3DE", fg: "#3B6D11" },
  groundwork: { bg: "#E1F5EE", fg: "#0F6E56" },
  lunging:    { bg: "#F1EFE8", fg: "#444441" },
  other:      { bg: "#F1EFE8", fg: "#5F5E5A" },
};

function dayKey(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function dayKeyForSort(iso: string): string {
  return iso.slice(0, 10);
}

export function SessionsTab({
  sessions,
  horseId,
  clients,
}: {
  sessions: SessionWithLabels[];
  horseId: string;
  clients: ClientOpt[];
}) {
  if (sessions.length === 0) {
    return (
      <div className="relative">
        <section className="card-elevated p-8 text-center">
          <h2 className="text-base font-semibold text-ink-900">No sessions yet</h2>
          <p className="text-sm text-ink-500 mt-1.5 max-w-sm mx-auto">
            Log the first ride below — or it will appear automatically when a scheduled lesson is marked completed.
          </p>
        </section>
        <AddSessionFAB horseId={horseId} clients={clients} />
      </div>
    );
  }

  // Group by day in display order (newest first).
  const groups = new Map<string, SessionWithLabels[]>();
  for (const s of sessions) {
    const key = dayKeyForSort(s.started_at);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }

  return (
    <div className="relative flex flex-col gap-5">
      {Array.from(groups.entries()).map(([key, rows]) => (
        <section key={key} className="card-elevated overflow-hidden">
          <header className="px-5 py-3 border-b border-ink-100 bg-ink-50/40">
            <h3 className="text-[12px] tracking-[0.04em] uppercase text-ink-500">
              {dayKey(rows[0].started_at)}
            </h3>
          </header>
          <ul className="divide-y divide-ink-100">
            {rows.map((s) => (
              <SessionRow key={s.id} s={s} />
            ))}
          </ul>
        </section>
      ))}
      <AddSessionFAB horseId={horseId} clients={clients} />
    </div>
  );
}

function SessionRow({ s }: { s: SessionWithLabels }) {
  const time = new Date(s.started_at).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const riderName = s.rider_client?.full_name ?? s.rider_name_freeform ?? "—";
  const initial = (riderName?.[0] ?? "?").toUpperCase();
  const tone = TYPE_TONE[s.type];

  return (
    <li className="px-5 py-3.5 flex items-start gap-3">
      <span className="w-9 h-9 shrink-0 rounded-full bg-ink-900 text-white text-[12px] font-medium inline-flex items-center justify-center">
        {initial}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[14px] text-ink-900 font-medium">{time}</span>
          <span className="text-[13px] text-ink-700">{riderName}</span>
          {s.trainer?.full_name && (
            <span className="text-[12px] text-ink-500">w/ {s.trainer.full_name}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <span
            className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: tone.bg, color: tone.fg }}
          >
            {TYPE_LABEL[s.type]}
          </span>
          <span className="text-[11.5px] text-ink-500">{s.duration_minutes} min</span>
          {s.rating != null && (
            <span className="text-[11.5px] text-ink-500">{"★".repeat(s.rating)}</span>
          )}
        </div>
        <SessionNoteEditor sessionId={s.id} initialNotes={s.notes} currentType={s.type} />
      </div>
    </li>
  );
}
