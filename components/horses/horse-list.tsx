import Link from "next/link";
import type { HorseWithWeeklyWorkload } from "@/services/horses";
import { EmptyState, Badge } from "@/components/ui";

export function HorseList({ horses }: { horses: HorseWithWeeklyWorkload[] }) {
  if (horses.length === 0) {
    return (
      <EmptyState
        title="No horses on the roster yet"
        body="Add your first horse to start scheduling lessons and tracking weekly workload. You can adjust limits and notes any time."
        primary={{ label: "Add your first horse", href: "/dashboard/horses?new=1" }}
      />
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Header row only on md+; on mobile each row is a card with labelled fields */}
      <div className="hidden md:grid grid-cols-[2fr_1fr_1.4fr_1fr_1fr] gap-3 px-5 py-3 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400">
        <div>Name</div>
        <div>Status</div>
        <div>This week</div>
        <div>Daily</div>
        <div>Weekly</div>
      </div>
      <ul className="divide-y divide-ink-100/60 md:divide-y-0">
        {horses.map((h) => {
          const overWeek = h.weekly.total_lessons >= h.weekly_lesson_limit;
          return (
            <li key={h.id}>
              <Link
                href={`/dashboard/horses/${h.id}`}
                className="
                  block px-4 md:px-5 py-3.5 md:py-4 text-sm
                  hover:bg-neutral-50/70 transition-colors
                  md:grid md:grid-cols-[2fr_1fr_1.4fr_1fr_1fr] md:gap-3 md:items-center
                "
              >
                {/* Mobile: name + status on first row; weekly + limits on a 2-col grid below */}
                <div className="flex items-center justify-between md:block">
                  <span className="font-semibold text-neutral-900">{h.name}</span>
                  <span className="md:hidden"><StatusPill active={h.active} /></span>
                </div>
                <div className="hidden md:block"><StatusPill active={h.active} /></div>
                <div className={`mt-1.5 md:mt-0 ${overWeek ? "text-rose-600 font-semibold" : "text-neutral-700"}`}>
                  {h.weekly.total_lessons}{" "}
                  <span className="text-neutral-400 font-normal">
                    {h.weekly.total_lessons === 1 ? "lesson" : "lessons"} · {h.weekly.total_minutes}m
                  </span>
                </div>
                <div className="hidden md:block text-neutral-700 tabular-nums">{h.daily_lesson_limit}</div>
                <div className="hidden md:block text-neutral-700 tabular-nums">{h.weekly_lesson_limit}</div>
                {/* Mobile-only limits row */}
                <div className="mt-1 flex gap-4 text-[11px] text-neutral-500 md:hidden">
                  <span>Daily limit: <span className="text-neutral-700 tabular-nums">{h.daily_lesson_limit}</span></span>
                  <span>Weekly limit: <span className="text-neutral-700 tabular-nums">{h.weekly_lesson_limit}</span></span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return active ? (
    <Badge tone="success" dot>Active</Badge>
  ) : (
    <Badge tone="muted" dot>Inactive</Badge>
  );
}
