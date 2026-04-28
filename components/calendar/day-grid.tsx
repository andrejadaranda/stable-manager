"use client";

// Day grid — single-column detail view used by:
//   * The desktop "Day" toggle in the hero.
//   * Expanding a day from the WeekGrid (clicking the day header or
//     the "+N more" overflow chip).
//
// Reuses DayColumn from week-grid.tsx so concurrent-lesson layout and
// click-to-create math stay consistent. The full-detail flag tells the
// column to render lesson cards with more info (trainer, status pill).

import { useMemo } from "react";
import type { CalendarLesson } from "@/services/lessons";
import {
  HOUR_START,
  HOUR_END,
  HOUR_HEIGHT,
  GRID_HEIGHT,
  buildLessonLayout,
} from "./grid-utils";
import { DayColumn } from "./week-grid";

export function DayGrid({
  day,
  dayKey,
  todayKey,
  lessons,
  onLessonClick,
  onSlotClick,
  onBack,
  dayPicker,
  editable,
}: {
  day: Date;
  dayKey: string;
  todayKey: string;
  lessons: CalendarLesson[];
  onLessonClick: (l: CalendarLesson) => void;
  onSlotClick: (startsLocal: string, endsLocal: string) => void;
  onBack: () => void;
  dayPicker: React.ReactNode;
  editable: boolean;
}) {
  const layout = useMemo(() => buildLessonLayout(lessons), [lessons]);
  const isToday = dayKey === todayKey;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl text-sm font-medium text-ink-700 hover:text-navy-900 hover:bg-white shadow-soft hover:shadow-lift transition"
        >
          ← Back to week
        </button>
        <div className="text-sm text-ink-500 font-medium">
          {day.toLocaleDateString(undefined, {
            weekday: "long",
            month:   "long",
            day:     "numeric",
          })}
        </div>
      </div>

      {dayPicker}

      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        <div className="grid grid-cols-[56px_minmax(0,1fr)]">
          <HourRail />
          <DayColumn
            day={day}
            isToday={isToday}
            layout={layout}
            onLessonClick={onLessonClick}
            onSlotClick={onSlotClick}
            editable={editable}
            fullDetail
          />
        </div>
      </div>

      {lessons.length === 0 && (
        <div className="text-center text-sm text-ink-500 py-2">
          No lessons on this day. Click any time slot to schedule one.
        </div>
      )}
    </div>
  );
}

// =============================================================
// Hour rail — local copy so DayGrid and WeekGrid don't share one
// instance and force a re-render when either re-mounts.
// =============================================================
function HourRail() {
  const hours = [];
  for (let h = HOUR_START; h <= HOUR_END; h++) hours.push(h);
  return (
    <div className="relative" style={{ height: GRID_HEIGHT }}>
      {hours.map((h) => (
        <div
          key={h}
          className="absolute left-0 right-2 text-[10px] tabular-nums text-ink-500 font-semibold tracking-wide"
          style={{ top: (h - HOUR_START) * HOUR_HEIGHT - 6 }}
        >
          <span className="block text-right pr-1">{fmtHour(h)}</span>
        </div>
      ))}
    </div>
  );
}

function fmtHour(h: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:00`;
}
