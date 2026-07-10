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
  action,
}: {
  title: string;
  subtitle: string;
  stats: SessionStats;
  /** Retained for call-site compatibility (stable vs client surfaces). */
  scope?: "stable" | "client";
  action?: React.ReactNode;
}) {
  const weekMax = Math.max(1, ...stats.weekDaily);
  const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
  const weekHours = (stats.weekMinutes / 60).toFixed(1);

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

      {/* Weekly hero — saddle time + per-day bars */}
      <div className="rounded-3xl p-5 text-brand-50 bg-gradient-to-br from-brand-700 to-brand-900 shadow-lift">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-saddle-200">This week</span>
          <span className="text-[13px] font-semibold text-brand-100">
            {stats.weekCount} {stats.weekCount === 1 ? "ride" : "rides"} · {fmtMin(stats.weekMinutes)}
          </span>
        </div>
        <div className="font-mono font-semibold text-[40px] leading-none mt-3 tabular-nums">
          {weekHours}
          <span className="text-[15px] font-sans text-brand-200 ml-1.5">h in the saddle</span>
        </div>
        <div className="flex items-end gap-2 h-[64px] mt-4">
          {stats.weekDaily.map((mins, i) => {
            const h = Math.round((mins / weekMax) * 100);
            const on = mins > 0;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <div
                  className={`w-full max-w-[26px] rounded-md ${on ? "bg-brand-200" : "bg-white/15"}`}
                  style={{ height: `${on ? Math.max(h, 12) : 12}%` }}
                />
                <span className="text-[10.5px] font-semibold text-brand-50/50">{DAY_LETTERS[i]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-3">
        <MiniCell label="This month" value={String(stats.monthCount)} sub="rides logged" />
        <MiniCell
          label="Top horse"
          value={stats.topHorse?.name ?? "—"}
          sub={stats.topHorse ? `${stats.topHorse.sessions} rides · 90d` : "no rides yet"}
        />
        <MiniCell label="Total · 90d" value={fmtHours(stats.totalMinutes)} sub="saddle time" />
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

function MiniCell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-soft p-3.5 min-w-0">
      <p className="text-[10px] uppercase tracking-[0.1em] font-bold text-ink-400 truncate">{label}</p>
      <p className="font-display text-[22px] text-navy-900 tabular-nums mt-1 truncate">{value}</p>
      <p className="text-[11px] text-ink-500 mt-0.5 truncate">{sub}</p>
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
