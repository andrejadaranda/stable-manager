"use client";

// Dashboard KPI panel with a Week / Month toggle (owner + employee).
// Personal accounts keep the simple rides + horses view (no toggle —
// the data is the same shape, week is what matters for a solo rider).

import { useState } from "react";

type Metrics = {
  weekLessonsCount: number;
  weekLessonsCompleted: number;
  monthLessonsCount: number;
  monthLessonsCompleted: number;
  activeHorses: number;
  outstandingBalance: number;
  weekRevenue: number;
  monthlyRevenue: number;
  monthLabel: string;
  isOwner: boolean;
  isPersonal: boolean;
};

const fmtEUR = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export function MetricsPanel(m: Metrics) {
  const [range, setRange] = useState<"week" | "month">(m.isPersonal ? "week" : "month");

  const lessons = range === "week" ? m.weekLessonsCount : m.monthLessonsCount;
  const completed = range === "week" ? m.weekLessonsCompleted : m.monthLessonsCompleted;
  const completedRatio = lessons > 0 ? Math.round((completed / lessons) * 100) : 0;
  const revenue = range === "week" ? m.weekRevenue : m.monthlyRevenue;
  // Collection % uses the chosen window's revenue vs outstanding (balance is a
  // running total, so this is an approximation — same as before).
  const collectionPct =
    revenue + m.outstandingBalance > 0
      ? Math.round((revenue / (revenue + m.outstandingBalance)) * 100)
      : 100;

  const empty = lessons === 0 && revenue === 0 && m.outstandingBalance === 0;
  const rangeWord = range === "week" ? "this week" : "this month";

  return (
    <aside className="card-elevated p-5 md:p-6 flex flex-col gap-5 lg:sticky lg:top-4 self-start">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-navy-900">Metrics</h2>
        {/* Range toggle */}
        <div className="inline-flex rounded-full bg-ink-100 p-0.5 text-[11px] font-medium">
          <button
            type="button"
            onClick={() => setRange("week")}
            className={`px-2.5 py-1 rounded-full transition-colors ${range === "week" ? "bg-white text-navy-900 shadow-sm" : "text-ink-500"}`}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => setRange("month")}
            className={`px-2.5 py-1 rounded-full transition-colors ${range === "month" ? "bg-white text-navy-900 shadow-sm" : "text-ink-500"}`}
          >
            Month
          </button>
        </div>
      </div>

      {empty ? (
        <EmptyMetrics isPersonal={m.isPersonal} />
      ) : m.isPersonal ? (
        <>
          <KpiRing
            label={`Rides ${rangeWord}`}
            value={`${lessons}`}
            sub={completed > 0 ? `${completed} completed` : "Log a session to track progress"}
            pct={Math.min(100, lessons * 14)}
            color="#E04E25"
          />
          <KpiRing
            label="Horses in care"
            value={`${m.activeHorses}`}
            sub={m.activeHorses === 0 ? "Add your first horse" : "Currently active"}
            pct={m.activeHorses > 0 ? 100 : 0}
            color="#1E2A47"
          />
        </>
      ) : m.isOwner ? (
        <>
          <KpiRing
            label={`Lessons ${rangeWord}`}
            value={`${lessons}`}
            sub={completed > 0 ? `${completedRatio}% completed` : "Scheduled"}
            pct={completedRatio}
            color="#E04E25"
          />
          <KpiRing
            label={`Collected ${rangeWord}`}
            value={fmtEUR(revenue)}
            sub={`${collectionPct}% of what's owed`}
            pct={collectionPct}
            color="#1E2A47"
          />
          <KpiRing
            label="Client balance"
            value={fmtEUR(m.outstandingBalance)}
            sub={m.outstandingBalance > 0 ? `${collectionPct}% collected` : "All paid up"}
            // Ring fills with the share ALREADY collected, so a fuller ring
            // always means better (more paid up) — not "more debt".
            pct={collectionPct}
            color={m.outstandingBalance > 0 ? "#C2841A" : "#3F7A3A"}
          />
        </>
      ) : (
        <>
          <KpiRing
            label={`Lessons ${rangeWord}`}
            value={`${lessons}`}
            sub={completed > 0 ? `${completedRatio}% completed` : "Scheduled"}
            pct={completedRatio}
            color="#E04E25"
          />
          <KpiRing
            label="Horses in care"
            value={`${m.activeHorses}`}
            sub={m.activeHorses === 0 ? "None active yet" : "Currently active"}
            pct={m.activeHorses > 0 ? 100 : 0}
            color="#1E2A47"
          />
        </>
      )}
    </aside>
  );
}

function KpiRing({
  label, value, sub, pct, color,
}: {
  label: string;
  value: string;
  sub: string;
  pct: number;
  color: string;
}) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <div className="flex items-center gap-4">
      <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#EFEAE2" strokeWidth="7" />
        <circle
          cx="32" cy="32" r={r} fill="none"
          stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-[0.04em] text-ink-500">{label}</div>
        <div className="font-display text-2xl text-navy-900 leading-tight">{value}</div>
        <div className="text-[12px] text-ink-500 truncate">{sub}</div>
      </div>
    </div>
  );
}

function EmptyMetrics({ isPersonal }: { isPersonal: boolean }) {
  return (
    <div className="text-[13px] text-ink-500 leading-relaxed py-2">
      {isPersonal
        ? "Log your first ride and add a horse — your stats will start filling in here."
        : "Add your first lesson and log a session — lessons, payments, and balances will start filling in."}
    </div>
  );
}
