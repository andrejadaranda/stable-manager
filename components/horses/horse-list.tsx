import Link from "next/link";
import type { HorseWithWeeklyWorkload } from "@/services/horses";

export function HorseList({ horses }: { horses: HorseWithWeeklyWorkload[] }) {
  if (horses.length === 0) {
    return (
      <EmptyState
        title="No horses yet"
        body='Add your first horse with "+ New horse" to start tracking workload.'
      />
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-[2fr_1fr_1.4fr_1fr_1fr] gap-3 px-6 py-3 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400">
        <div>Name</div>
        <div>Status</div>
        <div>This week</div>
        <div>Daily</div>
        <div>Weekly</div>
      </div>
      <ul>
        {horses.map((h) => {
          const overWeek = h.weekly.total_lessons >= h.weekly_lesson_limit;
          return (
            <li key={h.id}>
              <Link
                href={`/dashboard/horses/${h.id}`}
                className="grid grid-cols-[2fr_1fr_1.4fr_1fr_1fr] gap-3 px-6 py-4 text-sm hover:bg-neutral-50/70 transition-colors items-center"
              >
                <div className="font-semibold text-neutral-900">{h.name}</div>
                <div>
                  <StatusPill active={h.active} />
                </div>
                <div className={overWeek ? "text-rose-600 font-semibold" : "text-neutral-700"}>
                  {h.weekly.total_lessons}{" "}
                  <span className="text-neutral-400 font-normal">
                    {h.weekly.total_lessons === 1 ? "lesson" : "lessons"} · {h.weekly.total_minutes}m
                  </span>
                </div>
                <div className="text-neutral-700 tabular-nums">{h.daily_lesson_limit}</div>
                <div className="text-neutral-700 tabular-nums">{h.weekly_lesson_limit}</div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-neutral-300"
        }`}
      />
      <span className={active ? "text-neutral-700" : "text-neutral-400"}>
        {active ? "Active" : "Inactive"}
      </span>
    </span>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-12 text-center">
      <p className="text-base font-semibold text-neutral-800">{title}</p>
      <p className="text-sm text-neutral-500 mt-1.5">{body}</p>
    </div>
  );
}
