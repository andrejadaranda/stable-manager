"use client";

// Mobile day-agenda view.
//
// Below the md breakpoint we drop the time grid entirely and present
// a chronological list of the selected day's lessons. The day-pill
// row at the top lets the user move within the active week without
// horizontal scrolling. A floating "+" button creates a new lesson
// prefilled with the selected day.
//
// We intentionally don't try to render the time-grid on mobile — it
// either gets unreadably narrow or forces a horizontal scroll, both of
// which are worse than a vertical list.

import type { CalendarLesson } from "@/services/lessons";
import { fmtTime } from "@/lib/utils/dates";
import { STATUS_LABEL, STATUS_STYLE } from "./grid-utils";
import { PaymentDot } from "./week-grid";

export function DayAgenda({
  days,
  weekKeys,
  todayKey,
  selectedKey,
  onSelectDay,
  lessons,
  onLessonClick,
  onCreate,
  editable,
}: {
  days: Date[];
  weekKeys: string[];
  todayKey: string;
  selectedKey: string;
  onSelectDay: (k: string) => void;
  lessons: CalendarLesson[];
  onLessonClick: (l: CalendarLesson) => void;
  onCreate: () => void;
  editable: boolean;
}) {
  const sorted = [...lessons].sort(
    (a, b) => +new Date(a.starts_at) - +new Date(b.starts_at),
  );

  const selectedDay = days[Math.max(0, weekKeys.indexOf(selectedKey))] ?? days[0];

  return (
    <div className="flex flex-col gap-3">
      {/* Day pill picker ----------------------------------------- */}
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        {days.map((d, i) => {
          const k        = weekKeys[i];
          const isToday  = k === todayKey;
          const isActive = k === selectedKey;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onSelectDay(k)}
              className={
                isActive
                  ? "shrink-0 inline-flex flex-col items-center justify-center h-14 min-w-[48px] px-3 rounded-xl bg-navy-900 text-white"
                  : isToday
                  ? "shrink-0 inline-flex flex-col items-center justify-center h-14 min-w-[48px] px-3 rounded-xl bg-brand-50 text-brand-700"
                  : "shrink-0 inline-flex flex-col items-center justify-center h-14 min-w-[48px] px-3 rounded-xl bg-white text-ink-700 shadow-soft"
              }
            >
              <span className="text-[10px] uppercase tracking-[0.14em] font-medium opacity-80">
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </span>
              <span className="text-base font-semibold tabular-nums leading-none mt-1">
                {d.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Day header -------------------------------------------- */}
      <div className="text-sm text-ink-500 font-medium">
        {selectedDay.toLocaleDateString(undefined, {
          weekday: "long",
          month:   "long",
          day:     "numeric",
        })}
      </div>

      {/* Lesson list ------------------------------------------- */}
      <div className="flex flex-col gap-2 pb-24">
        {sorted.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-soft p-6 text-center">
            <p className="text-sm text-ink-700 font-medium">No lessons today.</p>
            <p className="text-xs text-ink-500 mt-1">
              Tap the orange button to schedule one.
            </p>
          </div>
        ) : (
          sorted.map((l) => (
            <AgendaCard
              key={l.id}
              lesson={l}
              onClick={() => onLessonClick(l)}
            />
          ))
        )}
      </div>

      {/* FAB --------------------------------------------------- */}
      {editable && (
        <button
          type="button"
          onClick={onCreate}
          aria-label="New lesson"
          className="
            fixed bottom-6 right-6 z-30
            h-14 w-14 rounded-full
            bg-brand-600 text-white text-2xl font-medium leading-none
            shadow-lift hover:bg-brand-700 active:bg-brand-800
            inline-flex items-center justify-center
          "
        >
          +
        </button>
      )}
    </div>
  );
}

function AgendaCard({
  lesson,
  onClick,
}: {
  lesson: CalendarLesson;
  onClick: () => void;
}) {
  const s = STATUS_STYLE[lesson.status];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative text-left rounded-2xl ${s.bg} ${s.border} ${s.dashed ? "border-dashed" : ""} shadow-soft hover:shadow-lift transition-shadow border-l-[3px] ${s.stripe}`}
    >
      <PaymentDot status={lesson.payment_status} />
      <div className="px-4 py-3 pr-12 flex items-center gap-3">
        <div className="flex flex-col tabular-nums shrink-0 w-16">
          <span className={`text-sm font-semibold ${s.ink}`}>
            {fmtTime(lesson.starts_at)}
          </span>
          <span className={`text-[11px] ${s.meta}`}>
            {fmtTime(lesson.ends_at)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${s.ink}`}>
            {lesson.client?.full_name ?? "—"}
          </p>
          <p className={`text-xs truncate ${s.meta}`}>
            {lesson.horse?.name ?? "—"} · {lesson.trainer?.full_name ?? "—"}
          </p>
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium ${s.pill} ${s.pillInk}`}>
          {STATUS_LABEL[lesson.status]}
        </span>
      </div>
    </button>
  );
}
