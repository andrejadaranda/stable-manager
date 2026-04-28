// Activity heatmap — last 7 days of session count per active horse.
// Server component; reads from the v_horse_activity_7d view via
// listHorseActivity7d(). The "wow" moment in the demo: under-worked
// horses jump out instantly.

import Link from "next/link";
import { listHorseActivity7d, type HorseActivity7d } from "@/services/sessions";

export async function ActivityHeatmap() {
  const rows = await listHorseActivity7d().catch(() => [] as HorseActivity7d[]);
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl bg-surface-muted px-6 py-8 text-center text-sm text-ink-500">
        No active horses yet. Add a horse to start logging sessions.
      </div>
    );
  }

  const max = Math.max(1, ...rows.map((r) => r.sessions_last_7d));
  const totalSessions = rows.reduce((s, r) => s + r.sessions_last_7d, 0);
  const idleHorses = rows.filter((r) => r.sessions_last_7d === 0).length;

  return (
    <div className="rounded-2xl bg-surface shadow-soft p-4 md:p-5">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[12px] uppercase tracking-[0.14em] text-ink-500">
          Last 7 days
        </p>
        <p className="text-[12px] text-ink-500">
          {totalSessions} session{totalSessions === 1 ? "" : "s"}
          {idleHorses > 0 && (
            <>
              <span className="text-ink-400"> · </span>
              <span className="text-amber-700">{idleHorses} idle</span>
            </>
          )}
        </p>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
        {rows.map((r) => (
          <li key={r.horse_id}>
            <Link
              href={`/dashboard/horses/${r.horse_id}`}
              className="flex items-center gap-3 py-1 group"
            >
              <span className="w-28 truncate text-sm text-ink-900 group-hover:text-brand-700 transition-colors">
                {r.name}
              </span>
              <span className="flex-1 h-2 rounded-full bg-ink-100 overflow-hidden relative">
                <span
                  className={`absolute inset-y-0 left-0 rounded-full ${heatColor(r.sessions_last_7d, max)}`}
                  style={{ width: `${(r.sessions_last_7d / max) * 100}%` }}
                />
              </span>
              <span className="w-12 text-right text-xs tabular-nums text-ink-600">
                {r.sessions_last_7d}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Color ramp: empty → idle (amber), low → muted, high → brand.
function heatColor(value: number, max: number): string {
  if (value === 0)            return "bg-amber-200";
  const ratio = value / max;
  if (ratio < 0.34)           return "bg-emerald-300";
  if (ratio < 0.67)           return "bg-emerald-500";
  return "bg-brand-600";
}
