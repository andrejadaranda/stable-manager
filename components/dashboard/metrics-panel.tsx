"use client";

// Dashboard KPI panel with a Week / Month toggle (owner + employee).
// Personal accounts keep the simple rides + horses view (no toggle —
// the data is the same shape, week is what matters for a solo rider).

import { useState } from "react";
import Link from "next/link";

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
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

type CardCfg = { label: string; value: string; sub: string; pct: number; tone: string; wide?: boolean };

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

  const cards: CardCfg[] = m.isPersonal
    ? [
        { label: `Rides ${rangeWord}`, value: `${lessons}`, sub: completed > 0 ? `${completed} completed` : "Log a session", pct: Math.min(100, lessons * 14), tone: "bg-brand-500" },
        { label: "Horses in care", value: `${m.activeHorses}`, sub: m.activeHorses === 0 ? "Add your first horse" : "Currently active", pct: m.activeHorses > 0 ? 100 : 0, tone: "bg-saddle-500" },
      ]
    : m.isOwner
    ? [
        { label: `Lessons ${rangeWord}`, value: `${lessons}`, sub: completed > 0 ? `${completedRatio}% completed` : "Scheduled", pct: completedRatio, tone: "bg-brand-500" },
        { label: `Collected ${rangeWord}`, value: fmtEUR(revenue), sub: `${collectionPct}% of what's owed`, pct: collectionPct, tone: "bg-brand-600" },
        { label: "Client balance", value: fmtEUR(m.outstandingBalance), sub: m.outstandingBalance > 0 ? `${collectionPct}% collected` : "All paid up", pct: collectionPct, tone: m.outstandingBalance > 0 ? "bg-saddle-500" : "bg-brand-500", wide: true },
      ]
    : [
        { label: `Lessons ${rangeWord}`, value: `${lessons}`, sub: completed > 0 ? `${completedRatio}% completed` : "Scheduled", pct: completedRatio, tone: "bg-brand-500" },
        { label: "Horses in care", value: `${m.activeHorses}`, sub: m.activeHorses === 0 ? "None active yet" : "Currently active", pct: m.activeHorses > 0 ? 100 : 0, tone: "bg-saddle-500" },
      ];

  return (
    <aside className="flex flex-col gap-3 lg:sticky lg:top-4 self-start">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="font-serif font-semibold text-[20px] text-ink-900">This {range}</h2>
        <div className="inline-flex rounded-full bg-surface-sunken p-[3px] text-[12px] font-semibold">
          <button type="button" onClick={() => setRange("week")} className={`px-3.5 py-1.5 rounded-full transition-colors ${range === "week" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500"}`}>Week</button>
          <button type="button" onClick={() => setRange("month")} className={`px-3.5 py-1.5 rounded-full transition-colors ${range === "month" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500"}`}>Month</button>
        </div>
      </div>

      {empty ? (
        <div className="card-elevated p-5"><EmptyMetrics isPersonal={m.isPersonal} /></div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {cards.map((c, i) => (
            <MetricCard key={i} {...c} />
          ))}
        </div>
      )}
    </aside>
  );
}

function MetricCard({ label, value, sub, pct, tone, wide }: CardCfg) {
  return (
    <div className={`bg-white border border-ink-100 rounded-2xl shadow-soft p-4 ${wide ? "col-span-2" : ""}`}>
      <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-400">{label}</div>
      <div className="font-mono font-semibold text-[24px] text-ink-900 mt-2 tabular-nums">{value}</div>
      <div className="text-[12px] text-ink-500 mt-0.5 truncate">{sub}</div>
      <div className="h-[7px] rounded-full bg-surface-sunken overflow-hidden mt-3">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
    </div>
  );
}

function EmptyMetrics({ isPersonal }: { isPersonal: boolean }) {
  return (
    <div className="py-2 flex flex-col gap-2.5">
      <p className="text-[13px] text-ink-500 leading-relaxed">
        {isPersonal
          ? "Log your first ride and add a horse — your stats will start filling in here."
          : "Add your first lesson and log a session — lessons, payments, and balances will start filling in."}
      </p>
      <Link
        href={isPersonal ? "/dashboard/horses?new=1" : "/dashboard/calendar"}
        className="inline-flex w-fit items-center gap-1 text-[12px] font-medium text-brand-700 hover:text-brand-800"
      >
        {isPersonal ? "Add your first horse" : "Book a lesson"} →
      </Link>
    </div>
  );
}
