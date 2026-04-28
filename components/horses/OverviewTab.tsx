// Overview tab — the daily-use view. Server component (no interactivity
// on Phase 1). All charts are inline SVG so we add zero JS bundle weight.

import Link from "next/link";
import type {
  HorseProfileSummary,
  HeatmapDay,
  TypeBreakdownSlice,
} from "@/services/horseProfile";
import type { SessionWithLabels, SessionType } from "@/services/sessions";

const SESSION_TYPE_LABEL: Record<SessionType, string> = {
  flat: "Flat",
  jumping: "Jumping",
  lunging: "Lunging",
  groundwork: "Groundwork",
  hack: "Hack",
  other: "Other",
};

// Earth-tone palette aligned with the design spec.
const TYPE_COLORS: Record<SessionType, string> = {
  flat:       "#B25430",
  jumping:    "#D88E6A",
  hack:       "#C2841A",
  groundwork: "#5A7A3A",
  lunging:    "#7A6E5A",
  other:      "#B0A89E",
};

const HEATMAP_COLORS = ["#F1EFE8", "#F0C9B5", "#D88E6A", "#B25430"];

export function OverviewTab({
  horse,
  heatmap,
  breakdown,
  recentSessions,
}: {
  horse: HorseProfileSummary;
  heatmap: HeatmapDay[];
  breakdown: TypeBreakdownSlice[];
  recentSessions: SessionWithLabels[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <ActivityRingCard horse={horse} />
      <HeatmapCard heatmap={heatmap} />
      <BreakdownCard breakdown={breakdown} />
      <RecentSessionsCard sessions={recentSessions} horseId={horse.id} />
    </div>
  );
}

// ---------- Activity ring -------------------------------------

function ActivityRingCard({ horse }: { horse: HorseProfileSummary }) {
  const used = horse.week.lesson_count;
  const cap = Math.max(1, horse.weekly_lesson_limit);
  const pct = Math.min(1, used / cap);
  const ringColor = pct >= 1 ? "#B23838" : pct >= 0.8 ? "#C2841A" : "#B25430";

  const r = 38;
  const c = 2 * Math.PI * r;
  const dash = c * pct;

  return (
    <section className="card-elevated p-5 md:p-6">
      <h2 className="text-sm font-semibold text-ink-900 mb-4">Weekly volume</h2>
      <div className="flex items-center gap-5">
        <svg width="92" height="92" viewBox="0 0 92 92" className="shrink-0">
          <circle cx="46" cy="46" r={r} fill="none" stroke="#F1EFE8" strokeWidth="10" />
          <circle
            cx="46"
            cy="46"
            r={r}
            fill="none"
            stroke={ringColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            transform="rotate(-90 46 46)"
          />
          <text
            x="46"
            y="44"
            textAnchor="middle"
            fontSize="18"
            fontWeight="500"
            fill="#231E1C"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            {used}
          </text>
          <text
            x="46"
            y="60"
            textAnchor="middle"
            fontSize="10"
            fill="#8A8079"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            of {cap}
          </text>
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-ink-700 leading-relaxed">
            {used} of {cap} lessons this week.
            {used === 0 && " Nothing scheduled yet — looks like a rest week."}
            {used > 0 && pct < 1 &&
              ` ${Math.round(horse.week.minutes_ridden)} minutes ridden so far.`}
            {pct >= 1 && " The horse has reached its weekly cap — book carefully."}
          </p>
          <div className="mt-3 h-1.5 bg-ink-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.round(pct * 100)}%`, background: ringColor }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- 12-week heatmap -----------------------------------

function HeatmapCard({ heatmap }: { heatmap: HeatmapDay[] }) {
  // Group into 12 columns × 7 rows. heatmap is ascending; align to weeks
  // by chunking from the END so "today" falls in the last column.
  const days = heatmap.length;
  const weeks: HeatmapDay[][] = [];
  for (let i = 0; i < days; i += 7) weeks.push(heatmap.slice(i, i + 7));

  // Tone bucket — 0..3 — based on quartiles of the visible data.
  const counts = heatmap.map((d) => d.count).filter((n) => n > 0).sort((a, b) => a - b);
  const q = (p: number) => counts.length ? counts[Math.floor((counts.length - 1) * p)] : 0;
  const t1 = Math.max(1, q(0.33));
  const t2 = Math.max(t1 + 1, q(0.66));
  function bucket(n: number): number {
    if (n === 0) return 0;
    if (n <= t1) return 1;
    if (n <= t2) return 2;
    return 3;
  }

  return (
    <section className="card-elevated p-5 md:p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-semibold text-ink-900">Last 12 weeks</h2>
        <span className="text-[11px] text-ink-500">Each square = 1 day</span>
      </div>
      <div className="flex gap-1 overflow-x-auto">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1 shrink-0">
            {week.map((d) => (
              <div
                key={d.date}
                title={`${d.date}: ${d.count} session${d.count === 1 ? "" : "s"}`}
                className="w-3.5 h-3.5 rounded"
                style={{ background: HEATMAP_COLORS[bucket(d.count)] }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-2 mt-3 text-[10.5px] text-ink-500">
        <span>Less</span>
        {HEATMAP_COLORS.map((c, i) => (
          <span key={i} className="inline-block w-2.5 h-2.5 rounded" style={{ background: c }} />
        ))}
        <span>More</span>
      </div>
    </section>
  );
}

// ---------- Training type donut + legend -----------------------

function BreakdownCard({ breakdown }: { breakdown: TypeBreakdownSlice[] }) {
  const total = breakdown.reduce((s, b) => s + b.count, 0);

  if (total === 0) {
    return (
      <section className="card-elevated p-5 md:p-6">
        <h2 className="text-sm font-semibold text-ink-900 mb-4">Training breakdown</h2>
        <p className="text-sm text-ink-500">
          No sessions logged in the last 30 days. Once trainers start logging rides, the type breakdown will appear here.
        </p>
      </section>
    );
  }

  const r = 34;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const slices = breakdown.map((s) => {
    const len = (s.count / total) * c;
    const slice = { type: s.type, len, offset, color: TYPE_COLORS[s.type] };
    offset += len;
    return slice;
  });

  return (
    <section className="card-elevated p-5 md:p-6">
      <h2 className="text-sm font-semibold text-ink-900 mb-4">Training breakdown</h2>
      <div className="flex items-center gap-6">
        <svg width="88" height="88" viewBox="0 0 88 88" className="shrink-0">
          <circle cx="44" cy="44" r={r} fill="none" stroke="#F1EFE8" strokeWidth="14" />
          {slices.map((s) => (
            <circle
              key={s.type}
              cx="44"
              cy="44"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="14"
              strokeDasharray={`${s.len} ${c - s.len}`}
              strokeDashoffset={-s.offset}
              transform="rotate(-90 44 44)"
            />
          ))}
        </svg>
        <ul className="flex-1 min-w-0 grid grid-cols-1 gap-1.5">
          {breakdown.map((s) => (
            <li key={s.type} className="flex items-center justify-between text-[13px]">
              <span className="inline-flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{ background: TYPE_COLORS[s.type] }}
                />
                <span className="text-ink-900">{SESSION_TYPE_LABEL[s.type]}</span>
              </span>
              <span className="text-ink-500 tabular-nums">
                {Math.round((s.count / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------- Recent sessions peek -------------------------------

function RecentSessionsCard({
  sessions,
  horseId,
}: {
  sessions: SessionWithLabels[];
  horseId: string;
}) {
  return (
    <section className="card-elevated p-5 md:p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-semibold text-ink-900">Recent sessions</h2>
        <Link
          href={`/dashboard/horses/${horseId}?tab=sessions`}
          className="text-[12px] text-brand-700 hover:text-brand-800 font-medium"
        >
          View all →
        </Link>
      </div>
      {sessions.length === 0 ? (
        <p className="text-sm text-ink-500">No sessions logged yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sessions.map((s) => {
            const riderName =
              s.rider_client?.full_name ?? s.rider_name_freeform ?? "—";
            const initial = (riderName?.[0] ?? "?").toUpperCase();
            const time = new Date(s.started_at).toLocaleString(undefined, {
              weekday: "short",
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <li key={s.id} className="flex items-center gap-3">
                <span className="w-8 h-8 shrink-0 rounded-full bg-ink-900 text-white text-[11px] font-medium inline-flex items-center justify-center">
                  {initial}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-medium text-ink-900 truncate">
                      {riderName}
                    </span>
                    {s.trainer?.full_name && (
                      <span className="text-[11px] text-ink-500">w/ {s.trainer.full_name}</span>
                    )}
                  </div>
                  <div className="text-[11.5px] text-ink-500 truncate">
                    {time} · {SESSION_TYPE_LABEL[s.type]} · {s.duration_minutes} min
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
