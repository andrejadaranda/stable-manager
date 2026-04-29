// Sessions hero — Fraunces title + KPI strip + optional inline action.
// Used on both /dashboard/sessions (staff) and /dashboard/my-sessions
// (client). The same `stats` shape powers both surfaces; only the
// labels swap based on `scope`.

import type { SessionStats } from "@/services/sessions";

const TYPE_LABEL: Record<string, string> = {
  flat: "Flat",
  jumping: "Jumping",
  lunging: "Lunging",
  groundwork: "Groundwork",
  hack: "Hack",
  other: "Other",
};

const TYPE_TONE: Record<string, string> = {
  flat:       "bg-brand-50 text-brand-700",
  jumping:    "bg-emerald-50 text-emerald-700",
  lunging:    "bg-amber-50 text-amber-700",
  groundwork: "bg-sky-50 text-sky-700",
  hack:       "bg-violet-50 text-violet-700",
  other:      "bg-ink-100 text-ink-700",
};

export function SessionsHero({
  title,
  subtitle,
  stats,
  scope,
  action,
}: {
  title: string;
  subtitle: string;
  stats: SessionStats;
  scope: "stable" | "client";
  action?: React.ReactNode;
}) {
  const isClient = scope === "client";

  // Pick four KPIs that tell a story per scope.
  const kpis = isClient
    ? [
        { label: "Rides",        value: String(stats.totalCount),                 sub: "All time" },
        { label: "Hours saddled", value: fmtHours(stats.totalMinutes),            sub: "All time" },
        { label: "Top horse",    value: stats.topHorse?.name ?? "—",              sub: stats.topHorse ? `${stats.topHorse.sessions} rides · last 90d` : "Pick one and ride" },
        { label: "Streak",       value: stats.currentStreakWeeks > 0 ? `${stats.currentStreakWeeks} wk` : "—", sub: "Consecutive ride weeks" },
      ]
    : [
        { label: "This week",    value: String(stats.weekCount),                  sub: `${fmtMin(stats.weekMinutes)}` },
        { label: "This month",   value: String(stats.monthCount),                 sub: `${fmtMin(stats.monthMinutes)}` },
        { label: "Top horse",    value: stats.topHorse?.name ?? "—",              sub: stats.topHorse ? `${stats.topHorse.sessions} sessions · last 90d` : "No rides yet" },
        { label: "Total minutes", value: fmtHours(stats.totalMinutes),            sub: "Last 90 days" },
      ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl md:text-4xl text-navy-900 leading-none">
            {title}
          </h1>
          <p className="text-sm text-ink-500 mt-2">{subtitle}</p>
        </div>
        {action}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white rounded-2xl shadow-soft p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-500">
              {k.label}
            </p>
            <p className="font-display text-2xl text-navy-900 tabular-nums mt-1 truncate">
              {k.value}
            </p>
            <p className="text-[11.5px] text-ink-500 mt-0.5 truncate">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Type breakdown chip row. Decorative — gives the rider/owner a
          quick read on what kind of riding has been happening. */}
      {stats.typeBreakdown.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-500 self-center">
            Last 90d:
          </span>
          {stats.typeBreakdown.map((t) => (
            <span
              key={t.type}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium ${TYPE_TONE[t.type] ?? TYPE_TONE.other}`}
            >
              {TYPE_LABEL[t.type] ?? t.type}
              <span className="opacity-70 tabular-nums">{t.count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtMin(min: number): string {
  if (min < 60) return `${min} min`;
  const hours = Math.floor(min / 60);
  const rem   = min % 60;
  return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`;
}

function fmtHours(min: number): string {
  if (min === 0) return "0h";
  const hours = min / 60;
  if (hours < 10) return `${hours.toFixed(1)}h`;
  return `${Math.round(hours)}h`;
}
