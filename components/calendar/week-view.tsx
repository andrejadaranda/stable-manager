"use client";

import { useState } from "react";
import Link from "next/link";
import { addDays, fmtDayLabel, fmtISODate, fmtTime } from "@/lib/utils/dates";
import type { CalendarLesson } from "@/services/lessons";
import { EditLessonDialog } from "@/components/calendar/edit-lesson-dialog";

// Status-driven lesson card style. One stripe color per status —
// stays accessible in monochrome printouts and at small sizes.
const STATUS_STYLE: Record<
  CalendarLesson["status"],
  { stripe: string; bg: string; ink: string; meta: string; pill: string; pillInk: string }
> = {
  scheduled: {
    stripe:  "bg-sky-400",
    bg:      "bg-white hover:bg-sky-50/40",
    ink:     "text-ink-900",
    meta:    "text-ink-500",
    pill:    "bg-sky-100",
    pillInk: "text-sky-700",
  },
  completed: {
    stripe:  "bg-emerald-500",
    bg:      "bg-white hover:bg-emerald-50/40",
    ink:     "text-ink-900",
    meta:    "text-ink-500",
    pill:    "bg-emerald-100",
    pillInk: "text-emerald-700",
  },
  cancelled: {
    stripe:  "bg-ink-300",
    bg:      "bg-ink-100/40 hover:bg-ink-100/60",
    ink:     "text-ink-400 line-through",
    meta:    "text-ink-300",
    pill:    "bg-ink-100",
    pillInk: "text-ink-500",
  },
  no_show: {
    stripe:  "bg-rose-500",
    bg:      "bg-white hover:bg-rose-50/40",
    ink:     "text-ink-900",
    meta:    "text-ink-500",
    pill:    "bg-rose-100",
    pillInk: "text-rose-700",
  },
};

const STATUS_LABEL: Record<CalendarLesson["status"], string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show:   "No-show",
};

export function WeekView({
  lessons,
  weekStart,
  basePath,
  editable = false,
}: {
  lessons: CalendarLesson[];
  weekStart: Date;
  basePath: string;
  editable?: boolean;
}) {
  const [selected, setSelected] = useState<CalendarLesson | null>(null);

  const days  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const prev  = fmtISODate(addDays(weekStart, -7));
  const next  = fmtISODate(addDays(weekStart, 7));
  const today = fmtISODate(new Date());

  const byDay = new Map<string, CalendarLesson[]>();
  for (const l of lessons) {
    const key = fmtISODate(new Date(l.starts_at));
    const arr = byDay.get(key) ?? [];
    arr.push(l);
    byDay.set(key, arr);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          <NavButton href={`${basePath}?date=${prev}`} label="←" ariaLabel="Previous week" />
          <NavButton href={`${basePath}?date=${today}`} label="Today" />
          <NavButton href={`${basePath}?date=${next}`} label="→" ariaLabel="Next week" />
        </div>
        <span className="text-sm text-neutral-500 font-medium tabular-nums">
          {fmtDayLabel(weekStart)} – {fmtDayLabel(addDays(weekStart, 6))}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {days.map((day) => {
          const key = fmtISODate(day);
          const isToday = key === today;
          const items = byDay.get(key) ?? [];
          return (
            <div
              key={key}
              className={`min-h-[200px] rounded-2xl bg-white overflow-hidden transition-shadow card-elevated ${
                isToday ? "ring-2 ring-brand-500/70" : ""
              }`}
            >
              <div className="px-4 pt-3.5 pb-2 flex items-baseline justify-between">
                <span className={`text-[10px] uppercase tracking-[0.14em] font-medium ${
                  isToday ? "text-brand-700" : "text-ink-500"
                }`}>
                  {day.toLocaleDateString(undefined, { weekday: "short" })}
                </span>
                <span className={`text-2xl font-semibold tabular-nums leading-none tracking-tightest ${
                  isToday ? "text-brand-700" : "text-ink-900"
                }`}>
                  {day.getDate()}
                </span>
              </div>
              <div className="p-2 flex flex-col gap-1.5">
                {items.length === 0 ? (
                  <p className="text-[11px] text-ink-300 px-2 py-1.5">
                    No lessons
                  </p>
                ) : (
                  items.map((l) =>
                    editable ? (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setSelected(l)}
                        className="text-left w-full"
                      >
                        <LessonCard lesson={l} />
                      </button>
                    ) : (
                      <LessonCard key={l.id} lesson={l} />
                    ),
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editable && selected && (
        <EditLessonDialog
          key={selected.id}
          lesson={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function LessonCard({ lesson }: { lesson: CalendarLesson }) {
  const s = STATUS_STYLE[lesson.status];
  return (
    <div
      className={`relative text-xs rounded-xl pl-3.5 pr-3 py-2.5 leading-tight transition-colors overflow-hidden ${s.bg}`}
    >
      <span className={`absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full ${s.stripe}`} />
      <div className="flex items-center gap-1.5">
        <span className={`font-semibold tabular-nums ${s.ink}`}>
          {fmtTime(lesson.starts_at)}
        </span>
        <span className={`${s.meta}`}>–</span>
        <span className={`tabular-nums ${s.meta}`}>
          {fmtTime(lesson.ends_at)}
        </span>
      </div>
      <div className={`mt-1 font-medium ${s.ink}`}>
        {lesson.client?.full_name ?? "—"}
      </div>
      <div className={`mt-0.5 text-[11px] ${s.meta}`}>
        {lesson.horse?.name ?? "—"} · {lesson.trainer?.full_name ?? "—"}
      </div>
      <div className="mt-1.5">
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium ${s.pill} ${s.pillInk}`}>
          {STATUS_LABEL[lesson.status]}
        </span>
      </div>
    </div>
  );
}

function NavButton({
  href,
  label,
  ariaLabel,
}: {
  href: string;
  label: string;
  ariaLabel?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="px-3 h-9 inline-flex items-center rounded-xl bg-white text-sm text-ink-700 hover:text-ink-900 shadow-soft hover:shadow-lift transition-shadow"
    >
      {label}
    </Link>
  );
}
