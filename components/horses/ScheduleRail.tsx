// Right-rail Schedule for the horse profile. 14-day window grouped by
// Today / Tomorrow / Later this week / Next week. Sticky on desktop.

import Link from "next/link";
import type { UpcomingLesson } from "@/services/horseProfile";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000);
}

function bucketLabel(starts: Date, now: Date): string {
  const diff = dayDiff(starts, now);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff <= 6)  return "Later this week";
  if (diff <= 13) return "Next week";
  return "Later";
}

const BUCKET_ORDER = ["Today", "Tomorrow", "Later this week", "Next week", "Later"];

export function ScheduleRail({
  horseId,
  lessons,
}: {
  horseId: string;
  lessons: UpcomingLesson[];
}) {
  const now = new Date();
  const groups = new Map<string, UpcomingLesson[]>();
  for (const l of lessons) {
    const label = bucketLabel(new Date(l.starts_at), now);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(l);
  }

  return (
    <aside className="card-elevated p-5 lg:sticky lg:top-4 self-start">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-semibold text-ink-900">Schedule</h2>
        <Link
          href="/dashboard/calendar"
          className="text-[12px] text-brand-700 hover:text-brand-800 font-medium"
        >
          + Book
        </Link>
      </div>
      {lessons.length === 0 ? (
        <p className="text-sm text-ink-500">No lessons scheduled in the next two weeks.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {BUCKET_ORDER.filter((b) => groups.has(b)).map((b) => (
            <div key={b}>
              <div className="text-[10.5px] tracking-[0.04em] uppercase text-ink-500 mb-2">
                {b}
              </div>
              <ul className="flex flex-col gap-2">
                {groups.get(b)!.map((l) => (
                  <ScheduleRow key={l.id} l={l} highlight={b === "Today"} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

function ScheduleRow({ l, highlight }: { l: UpcomingLesson; highlight: boolean }) {
  const start = new Date(l.starts_at);
  const end = new Date(l.ends_at);
  const time = start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const duration = Math.round((end.getTime() - start.getTime()) / 60000);
  const accent = highlight ? "#B25430" : "#F0C9B5";

  return (
    <li className="flex items-stretch gap-2.5 text-[12.5px]">
      <span
        className="w-1 rounded-sm shrink-0"
        style={{ background: accent }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-ink-900 font-medium truncate">
          {time} — {l.client?.full_name ?? "—"}
        </div>
        <div className="text-[11px] text-ink-500 truncate">
          {l.trainer?.full_name ?? "—"} · {duration} min
        </div>
      </div>
    </li>
  );
}
