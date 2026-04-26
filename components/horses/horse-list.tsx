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
    <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
      <div className="grid grid-cols-[2fr_1fr_1.4fr_1fr_1fr] gap-3 px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-neutral-500 bg-neutral-50 border-b border-neutral-200">
        <div>Name</div>
        <div>Status</div>
        <div>This week</div>
        <div>Daily limit</div>
        <div>Weekly limit</div>
      </div>
      <ul className="divide-y divide-neutral-200">
        {horses.map((h) => {
          const overWeek = h.weekly.total_lessons >= h.weekly_lesson_limit;
          return (
            <li key={h.id}>
              <Link
                href={`/dashboard/horses/${h.id}`}
                className="grid grid-cols-[2fr_1fr_1.4fr_1fr_1fr] gap-3 px-5 py-3.5 text-sm hover:bg-neutral-50 transition-colors items-center"
              >
                <div className="font-semibold text-neutral-900">{h.name}</div>
                <div>
                  <StatusPill active={h.active} />
                </div>
                <div className={overWeek ? "text-red-700 font-semibold" : "text-neutral-700"}>
                  {h.weekly.total_lessons}{" "}
                  {h.weekly.total_lessons === 1 ? "lesson" : "lessons"}
                  <span className="text-neutral-500 font-normal">
                    {" "}· {h.weekly.total_minutes} min
                  </span>
                </div>
                <div className="text-neutral-700 tabular-nums">
                  {h.daily_lesson_limit}/day
                </div>
                <div className="text-neutral-700 tabular-nums">
                  {h.weekly_lesson_limit}/wk
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
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
        active
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-neutral-100 text-neutral-600 border border-neutral-200"
      }`}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-neutral-400"
        }`}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-dashed border-neutral-300 rounded-lg bg-white p-10 text-center">
      <p className="text-sm font-semibold text-neutral-800">{title}</p>
      <p className="text-xs text-neutral-500 mt-1">{body}</p>
    </div>
  );
}
