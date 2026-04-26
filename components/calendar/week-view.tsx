"use client";

import { useState } from "react";
import Link from "next/link";
import { addDays, fmtDayLabel, fmtISODate, fmtTime } from "@/lib/utils/dates";
import type { CalendarLesson } from "@/services/lessons";
import { EditLessonDialog } from "@/components/calendar/edit-lesson-dialog";

const STATUS_STYLES: Record<
  CalendarLesson["status"],
  { card: string; dot: string; label: string }
> = {
  scheduled: {
    card:  "bg-blue-50/70 border-blue-200 hover:bg-blue-50",
    dot:   "bg-blue-500",
    label: "text-blue-900",
  },
  completed: {
    card:  "bg-emerald-50/70 border-emerald-200 hover:bg-emerald-50",
    dot:   "bg-emerald-500",
    label: "text-emerald-900",
  },
  cancelled: {
    card:  "bg-neutral-100 border-neutral-200 hover:bg-neutral-100/80 opacity-60",
    dot:   "bg-neutral-400",
    label: "text-neutral-600 line-through",
  },
  no_show: {
    card:  "bg-red-50/70 border-red-200 hover:bg-red-50",
    dot:   "bg-red-500",
    label: "text-red-900",
  },
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <NavButton href={`${basePath}?date=${prev}`} label="← Prev" />
          <NavButton href={`${basePath}?date=${today}`} label="Today" />
          <NavButton href={`${basePath}?date=${next}`} label="Next →" />
        </div>
        <span className="text-sm text-neutral-600 font-medium">
          {fmtDayLabel(weekStart)} – {fmtDayLabel(addDays(weekStart, 6))}
        </span>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const key = fmtISODate(day);
          const isToday = key === today;
          const items = byDay.get(key) ?? [];
          return (
            <div
              key={key}
              className={`min-h-[160px] border rounded-lg bg-white overflow-hidden ${
                isToday ? "border-neutral-900 ring-1 ring-neutral-900" : "border-neutral-200"
              }`}
            >
              <div
                className={`px-3 py-2 border-b ${
                  isToday
                    ? "bg-neutral-900 text-white border-neutral-900"
                    : "bg-neutral-50 border-neutral-200 text-neutral-700"
                }`}
              >
                <div className="text-[10px] uppercase tracking-wider opacity-70">
                  {day.toLocaleDateString(undefined, { weekday: "short" })}
                </div>
                <div className="text-lg font-semibold leading-tight">
                  {day.getDate()}
                </div>
              </div>
              <div className="p-1.5 flex flex-col gap-1.5">
                {items.length === 0 ? (
                  <p className="text-[11px] text-neutral-400 px-1.5 py-1.5">
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
  const s = STATUS_STYLES[lesson.status];
  return (
    <div
      className={`text-xs rounded-md border px-2.5 py-2 leading-tight transition-colors ${s.card}`}
    >
      <div className={`flex items-center gap-1.5 font-semibold ${s.label}`}>
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${s.dot}`} />
        {fmtTime(lesson.starts_at)}–{fmtTime(lesson.ends_at)}
      </div>
      <div className={`mt-1 font-medium ${s.label}`}>
        {lesson.client?.full_name ?? "—"}
      </div>
      <div className="mt-0.5 text-neutral-600">
        {lesson.horse?.name ?? "—"}
      </div>
      <div className="text-neutral-500">
        {lesson.trainer?.full_name ?? "—"}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mt-1">
        {STATUS_LABEL[lesson.status]}
      </div>
    </div>
  );
}

function NavButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-md border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100 transition-colors"
    >
      {label}
    </Link>
  );
}
