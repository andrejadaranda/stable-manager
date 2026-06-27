// Sessions tab — list grouped by day with an Add session FAB.
// Phase 2 adds the quick-add sheet (4-field flow) plus inline notes
// (handled per-row in SessionRow).

import type { SessionWithLabels, SessionType } from "@/services/sessions";
import { SESSION_TYPE_LABEL } from "@/services/sessions.types";
import { AddSessionFAB } from "./AddSessionSheet";
import { SessionNoteEditor } from "./SessionNoteEditor";

type ClientOpt = { id: string; full_name: string };

const TYPE_LABEL: Record<SessionType, string> = SESSION_TYPE_LABEL;

const TYPE_TONE: Record<SessionType, { bg: string; fg: string }> = {
  flat:          { bg: "#FAECE7", fg: "#993C1D" },
  dressage:      { bg: "#F2E2DA", fg: "#7A2E15" },
  jumping:       { bg: "#FAEEDA", fg: "#854F0B" },
  cross_country: { bg: "#F5E6D0", fg: "#6E4811" },
  hack:          { bg: "#EAF3DE", fg: "#3B6D11" },
  western:       { bg: "#F0E4CC", fg: "#7B5410" },
  groundwork:    { bg: "#E1F5EE", fg: "#0F6E56" },
  lunging:       { bg: "#F1EFE8", fg: "#444441" },
  vaulting:      { bg: "#EEE6F4", fg: "#5A3F7A" },
  rehab:         { bg: "#E0EEF2", fg: "#26515E" },
  other:         { bg: "#F1EFE8", fg: "#5F5E5A" },
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
      <TrainingLoad sessions={sessions} />
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

// Training-load roll-up — the welfare/workload lens that sets Longrein
// apart from rider-only apps. Computed purely from the sessions already
// loaded for this horse, so it adds no queries.
function TrainingLoad({ sessions }: { sessions: SessionWithLabels[] }) {
  const now = Date.now();
  const DAY = 86_400_000;

  let last = 0;            // most-recent session timestamp
  let week = 0, weekMin = 0;
  let month = 0, monthMin = 0;
  const typeCount = new Map<SessionType, number>();
  // 8 week-buckets, index 0 = oldest, 7 = current week.
  const weeks = new Array(8).fill(0);

  for (const s of sessions) {
    const t = new Date(s.started_at).getTime();
    if (!Number.isFinite(t)) continue;
    if (t > last) last = t;
    const ageDays = (now - t) / DAY;
    if (ageDays <= 7)  { week  += 1; weekMin  += s.duration_minutes || 0; }
    if (ageDays <= 30) { month += 1; monthMin += s.duration_minutes || 0; }
    if (ageDays <= 56) {
      const bucket = 7 - Math.floor(ageDays / 7);
      if (bucket >= 0 && bucket <= 7) weeks[bucket] += 1;
    }
    typeCount.set(s.type, (typeCount.get(s.type) ?? 0) + 1);
  }

  const daysSince = last ? Math.floor((now - last) / DAY) : null;
  const topTypes = Array.from(typeCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const maxWeek = Math.max(1, ...weeks);

  // Rest signal — gentle welfare nudge, not alarmist.
  const rest =
    daysSince == null ? null
    : daysSince === 0 ? { label: "Ridden today", tone: "text-emerald-700" }
    : daysSince <= 2  ? { label: `${daysSince}d since last ride`, tone: "text-ink-600" }
    : daysSince <= 6  ? { label: `${daysSince}d since last ride`, tone: "text-amber-700" }
    : { label: `${daysSince}d since last ride`, tone: "text-rose-700" };

  return (
    <section className="card-elevated p-5 flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[12px] tracking-[0.04em] uppercase text-ink-500">Training load</h3>
        {rest && <span className={`text-[12px] font-medium ${rest.tone}`}>{rest.label}</span>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <LoadStat value={String(week)}  unit={week === 1 ? "ride" : "rides"} label="last 7 days" />
        <LoadStat value={fmtHrs(weekMin)}  unit="" label="saddle time · 7d" />
        <LoadStat value={String(month)} unit={month === 1 ? "ride" : "rides"} label="last 30 days" />
        <LoadStat value={fmtHrs(monthMin)} unit="" label="saddle time · 30d" />
      </div>

      {/* 8-week activity bars */}
      <div className="flex items-end gap-1.5 h-12" aria-hidden>
        {weeks.map((n, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end" title={`${n} ride${n === 1 ? "" : "s"}`}>
            <div
              className="rounded-sm bg-saddle-500"
              style={{ height: `${Math.max(6, (n / maxWeek) * 100)}%`, opacity: n === 0 ? 0.18 : 1 }}
            />
          </div>
        ))}
      </div>
      <p className="text-[11px] text-ink-400 -mt-2">Rides per week · last 8 weeks (newest right)</p>

      {topTypes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {topTypes.map(([type, count]) => {
            const tone = TYPE_TONE[type];
            return (
              <span
                key={type}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: tone.bg, color: tone.fg }}
              >
                {TYPE_LABEL[type]} <span className="opacity-70 tabular-nums">{count}</span>
              </span>
            );
          })}
        </div>
      )}
    </section>
  );
}

function LoadStat({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <div className="rounded-xl bg-ink-50/50 px-3 py-2.5">
      <div className="font-display text-xl text-navy-700 tabular-nums leading-none">
        {value}{unit && <span className="text-[12px] text-ink-500 font-sans ml-1">{unit}</span>}
      </div>
      <div className="text-[10.5px] uppercase tracking-wider text-ink-500 mt-1">{label}</div>
    </div>
  );
}

function fmtHrs(mins: number): string {
  if (mins <= 0) return "0h";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function SessionRow({ s }: { s: SessionWithLabels }) {
  const time = new Date(s.started_at).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Vilnius",   // server component — avoid UTC (3h-early) render
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
