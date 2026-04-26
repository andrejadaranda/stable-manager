"use client";

import { useState } from "react";
import Link from "next/link";
import { addDays, fmtDayLabel, fmtISODate, fmtTime } from "@/lib/utils/dates";
import type { CalendarLesson } from "@/services/lessons";
import { EditLessonDialog } from "@/components/calendar/edit-lesson-dialog";

const STATUS_DOT: Record<CalendarLesson["status"], string> = {
  scheduled: "bg-blue-500",
  completed: "bg-emerald-500",
  cancelled: "bg-neutral-400",
  no_show:   "bg-rose-500",
};

const STATUS_LABEL: Record<CalendarLesson["status"], string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show:   "No show",
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
              className={`min-h-[180px] rounded-2xl bg-white overflow-hidden transition-shadow ${
                isToday
                  ? "ring-2 ring-neutral-900 shadow-[0_8px_24px_-8px_rgba(15,15,20,0.18)]"
                  : "shadow-[0_1px_2px_rgba(15,15,20,0.04),0_8px_24px_-8px_rgba(15,15,20,0.06)]"
              }`}
            >
              <div className="px-4 pt-3 pb-2 flex items-baseline justify-between">
                <span className={`text-[10px] uppercase tracking-[0.12em] ${
                  isToday ? "text-neutral-900 font-semibold" : "text-neutral-400"
                }`}>
                  {day.toLocaleDateString(undefined, { weekday: "short" })}
                </span>
                <span className={`text-2xl font-semibold tabular-nums leading-none ${
                  isToday ? "text-neutral-900" : "text-neutral-700"
                }`}>
                  {day.getDate()}
                </span>
              </div>
              <div className="p-2 flex flex-col gap-1.5">
                {items.length === 0 ? (
                  <p className="text-[11px] text-neutral-300 px-2 py-1.5 italic">
                    Free
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
  const dot = STATUS_DOT[lesson.status];
  const muted = lesson.status === "cancelled";
  return (
    <div
      className={`text-xs rounded-xl px-3 py-2.5 leading-tight transition-colors ${
        muted
          ? "bg-neutral-50 text-neutral-400"
          : "bg-neutral-50/70 hover:bg-neutral-100/80 text-neutral-800"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${dot}`} />
        <span className="font-semibold tabular-nums">
          {fmtTime(lesson.starts_at)}
        </span>
        <span className="text-neutral-400">→</span>
        <span className="text-neutral-500 tabular-nums">
          {fmtTime(lesson.ends_at)}
        </span>
      </div>
      <div className={`mt-1.5 font-medium ${muted ? "line-through" : ""}`}>
        {lesson.client?.full_name ?? "—"}
      </div>
      <div className="mt-0.5 text-[11px] text-neutral-500">
        {lesson.horse?.name ?? "—"} · {lesson.trainer?.full_name ?? "—"}
      </div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-neutral-400 mt-1.5">
        {STATUS_LABEL[lesson.status]}
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
      className="px-3 py-1.5 rounded-xl bg-white text-sm text-neutral-700 hover:text-neutral-900 hover:bg-white shadow-[0_1px_2px_rgba(15,15,20,0.04),0_4px_12px_-6px_rgba(15,15,20,0.06)] transition-all hover:shadow-[0_1px_2px_rgba(15,15,20,0.06),0_8px_18px_-6px_rgba(15,15,20,0.10)]"
    >
      {label}
    </Link>
  );
}
