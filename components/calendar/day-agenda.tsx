"use client";

// Mobile day-agenda view.
//
// Below the md breakpoint we drop the time grid entirely and present
// a chronological list of the selected day's lessons — interleaved
// with tappable "free" rows that show the open gaps between lessons.
// The day-pill row at the top moves within the active week.
//
// Why the free-gap rows: a bare list of booked lessons hides the
// shape of the day — you can't see "I have 09:00 free, 11:00 free"
// at a glance. The gap rows restore that, and tapping one opens the
// create form prefilled to that time. (Andreja flagged this from
// real-yard testing 2026-05-15 — "per telefoną nematau laisvų laikų".)
//
// We still don't render the full time-grid on mobile — it gets
// unreadably narrow or forces horizontal scroll. The gap rows are the
// lightweight middle ground.

import type { CalendarLesson } from "@/services/lessons";
import { fmtTime } from "@/lib/utils/dates";
import { STATUS_LABEL, STATUS_STYLE, HOUR_START, HOUR_END } from "./grid-utils";
import { PaymentDot } from "./week-grid";

/** Local "YYYY-MM-DDTHH:mm" from a Date — matches the create form input. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Human gap label — "2h 30min free", "45min free", "1h free". */
function gapLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}min free`;
  if (h > 0)          return `${h}h free`;
  return `${m}min free`;
}

type Row =
  | { kind: "lesson"; lesson: CalendarLesson }
  | { kind: "gap"; startsLocal: string; endsLocal: string; minutes: number; label: string };

/** Build the interleaved lesson + free-gap row list for one day.
 *  Gaps shorter than 30 min are folded into the surrounding whitespace
 *  (too small to be a useful booking slot, not worth a row). */
function buildRows(
  lessons: CalendarLesson[],
  day: Date,
): Row[] {
  const sorted = [...lessons].sort(
    (a, b) => +new Date(a.starts_at) - +new Date(b.starts_at),
  );

  // Day bounds — working window from grid-utils (07:00–21:00 until
  // owner-configurable hours ship). Used as the first/last gap edges.
  const dayStart = new Date(day);
  dayStart.setHours(HOUR_START, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(HOUR_END, 0, 0, 0);

  const MIN_GAP = 30; // minutes — below this, no gap row
  const rows: Row[] = [];

  function pushGap(from: Date, to: Date) {
    const minutes = Math.round((to.getTime() - from.getTime()) / 60000);
    if (minutes < MIN_GAP) return;
    // Booking slot defaults to 45 min (or the gap, if smaller).
    const slotEnd = new Date(from);
    slotEnd.setMinutes(slotEnd.getMinutes() + Math.min(45, minutes));
    rows.push({
      kind: "gap",
      startsLocal: toLocalInput(from),
      endsLocal:   toLocalInput(slotEnd),
      minutes,
      label: gapLabel(minutes),
    });
  }

  let cursor = dayStart;
  for (const l of sorted) {
    const ls = new Date(l.starts_at);
    const le = new Date(l.ends_at);
    // Gap before this lesson (only when the lesson starts after the cursor).
    if (ls.getTime() > cursor.getTime()) pushGap(cursor, ls);
    rows.push({ kind: "lesson", lesson: l });
    // Advance the cursor past this lesson (handles overlaps gracefully).
    if (le.getTime() > cursor.getTime()) cursor = le;
  }
  // Trailing gap to end of day.
  if (cursor.getTime() < dayEnd.getTime()) pushGap(cursor, dayEnd);

  return rows;
}

export function DayAgenda({
  days,
  weekKeys,
  todayKey,
  selectedKey,
  onSelectDay,
  lessons,
  onLessonClick,
  onCreate,
  onSlotCreate,
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
  /** Tapping a free-gap row opens the create form prefilled to that
   *  slot. Optional — when omitted (read-only client calendar) gap
   *  rows render as static labels with no tap affordance. */
  onSlotCreate?: (startsLocal: string, endsLocal: string) => void;
  editable: boolean;
}) {
  const selectedDay = days[Math.max(0, weekKeys.indexOf(selectedKey))] ?? days[0];
  const rows = buildRows(lessons, selectedDay);
  const hasLessons = lessons.length > 0;

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

      {/* Interleaved lesson + free-gap list -------------------- */}
      <div className="flex flex-col gap-2 pb-24">
        {!hasLessons ? (
          <>
            <div className="bg-white rounded-2xl shadow-soft p-6 text-center">
              <p className="text-sm text-ink-700 font-medium">No lessons today.</p>
              <p className="text-xs text-ink-500 mt-1">
                Tap a free slot below, or the orange button, to schedule one.
              </p>
            </div>
            {/* Even on an empty day, show the open slots so the shape of
                the working day is visible and bookable. */}
            {rows.map((row, idx) =>
              row.kind === "gap" ? (
                <GapRow
                  key={`gap-${idx}`}
                  row={row}
                  onTap={
                    editable && onSlotCreate
                      ? () => onSlotCreate(row.startsLocal, row.endsLocal)
                      : undefined
                  }
                />
              ) : null,
            )}
          </>
        ) : (
          rows.map((row, idx) =>
            row.kind === "lesson" ? (
              <AgendaCard
                key={row.lesson.id}
                lesson={row.lesson}
                onClick={() => onLessonClick(row.lesson)}
              />
            ) : (
              <GapRow
                key={`gap-${idx}`}
                row={row}
                onTap={
                  editable && onSlotCreate
                    ? () => onSlotCreate(row.startsLocal, row.endsLocal)
                    : undefined
                }
              />
            ),
          )
        )}
      </div>

      {/* FAB ----------------------------------------------------
          Pinned bottom-right. iOS safe-area math keeps it clear of
          the home indicator on notched iPhones, and the Report a
          Problem widget intentionally sits bottom-LEFT on mobile
          so the two never collide. */}
      {editable && (
        <button
          type="button"
          onClick={onCreate}
          aria-label="New lesson"
          className="
            fixed right-4 sm:right-6 z-30
            bottom-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))]
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

// A free-time gap between (or around) lessons. Tappable when editable —
// opens the create form prefilled to the gap's start.
function GapRow({
  row,
  onTap,
}: {
  row: Extract<Row, { kind: "gap" }>;
  onTap?: () => void;
}) {
  const startTime = row.startsLocal.slice(11, 16);
  const content = (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="text-[13px] font-semibold text-ink-500 tabular-nums shrink-0 w-16">
        {startTime}
      </span>
      <span className="flex-1 border-t border-dashed border-ink-200" aria-hidden />
      <span className="text-[11.5px] font-medium text-ink-500 shrink-0">
        {row.label}
      </span>
      {onTap && (
        <span className="text-[11.5px] font-semibold text-brand-700 shrink-0">
          + Book
        </span>
      )}
    </div>
  );

  if (!onTap) {
    return <div className="rounded-xl">{content}</div>;
  }
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`Book a lesson at ${startTime} — ${row.label}`}
      className="text-left rounded-xl hover:bg-brand-50/50 active:bg-brand-50 transition-colors"
    >
      {content}
    </button>
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
