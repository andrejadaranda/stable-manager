"use client";

// Week grid — 7 columns × hour rail.
//
// Layout
//   * Single horizontal scroll on narrow viewports.
//   * Sticky day-header row stays visible while the body scrolls.
//   * Hour rail (left) shows each hour from HOUR_START..HOUR_END.
//   * Lessons are absolutely positioned inside their day column based on
//     their start minute and duration — durations crossing the hour line
//     just keep flowing through.
//
// Concurrent lessons
//   * If two lessons overlap they sit side-by-side, splitting the column
//     evenly. Up to MAX_VISIBLE columns; anything past that collapses
//     into a single "+N more" chip that opens the day detail.
//
// Click-to-create
//   * Clicking the body of a column — but not on a lesson — computes the
//     minute offset of the click and snaps to SNAP_MIN. The shell opens
//     the create form prefilled with that start and a 45-min default end.
//
// All sizes / colors are tokens (Tailwind + design system) so the grid
// stays consistent with the rest of the dashboard.

import { useMemo } from "react";
import type { CalendarLesson, LessonPaymentStatus } from "@/services/lessons";
import {
  HOUR_START,
  HOUR_END,
  HOUR_HEIGHT,
  SNAP_MIN,
  GRID_HEIGHT,
  buildLessonLayout,
  computeSlotFromOffset,
  STATUS_STYLE,
  STATUS_LABEL,
} from "./grid-utils";
import { fmtTime } from "@/lib/utils/dates";

export function WeekGrid({
  days,
  weekKeys,
  todayKey,
  byDay,
  onLessonClick,
  onSlotClick,
  onDayHeaderClick,
  onLessonDrop,
  editable,
}: {
  days: Date[];
  weekKeys: string[];
  todayKey: string;
  byDay: Map<string, CalendarLesson[]>;
  onLessonClick: (l: CalendarLesson) => void;
  onSlotClick: (startsLocal: string, endsLocal: string) => void;
  onDayHeaderClick: (key: string) => void;
  /** Drag-and-drop reschedule callback. Receives lesson + new local
   *  start string (snapped to 15-min). Optional — when omitted, drag
   *  is disabled (e.g. read-only client portal calendar). */
  onLessonDrop?: (lessonId: string, newStartLocal: string) => void;
  editable: boolean;
}) {
  // Pre-compute layout per day so render is cheap.
  const layouts = useMemo(() => {
    return weekKeys.map((k) => buildLessonLayout(byDay.get(k) ?? []));
  }, [weekKeys, byDay]);

  return (
    // Outer wrapper carries the rounded corner + shadow; inner scroller
    // absorbs horizontal overflow on narrow desktop widths so the grid
    // never gets squeezed. min-w on the grid keeps each day legible.
    <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
      <div className="overflow-x-auto">
        <div className="grid grid-cols-[56px_repeat(7,minmax(120px,1fr))] min-w-[880px]">
        {/* Header row -------------------------------------------------- */}
        <div className="border-b border-ink-100 bg-white" />
        {days.map((d, i) => {
          const k = weekKeys[i];
          const isToday = k === todayKey;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onDayHeaderClick(k)}
              className={
                isToday
                  ? "border-b-2 border-brand-500 bg-brand-50/40 px-3 py-3 text-left hover:bg-brand-50"
                  : "border-b border-ink-100 bg-white px-3 py-3 text-left hover:bg-ink-100/40"
              }
              aria-label={`Open ${d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={
                    isToday
                      ? "text-[10px] uppercase tracking-[0.14em] font-semibold text-brand-700"
                      : "text-[10px] uppercase tracking-[0.14em] font-medium text-ink-500"
                  }
                >
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                </span>
                {isToday && (
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-700">
                    Today
                  </span>
                )}
              </div>
              <div
                className={
                  isToday
                    ? "mt-0.5 text-2xl font-semibold tabular-nums leading-none text-brand-700"
                    : "mt-0.5 text-2xl font-semibold tabular-nums leading-none text-navy-900"
                }
              >
                {d.getDate()}
              </div>
            </button>
          );
        })}

        {/* Body — hour rail + 7 day columns -------------------------- */}
        <HourRail />
        {days.map((d, i) => {
          const k = weekKeys[i];
          const isToday = k === todayKey;
          const layout = layouts[i];
          return (
            <DayColumn
              key={k}
              day={d}
              isToday={isToday}
              layout={layout}
              onLessonClick={onLessonClick}
              onSlotClick={onSlotClick}
              onOverflowClick={() => onDayHeaderClick(k)}
              onLessonDrop={onLessonDrop}
              editable={editable}
            />
          );
        })}
        </div>
      </div>
    </div>
  );
}

// =============================================================
// Hour rail
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

// =============================================================
// Day column — used by both Week (small) and Day (full) views
// =============================================================
export function DayColumn({
  day,
  isToday,
  layout,
  onLessonClick,
  onSlotClick,
  onOverflowClick,
  onLessonDrop,
  editable,
  fullDetail = false,
}: {
  day: Date;
  isToday: boolean;
  layout: ReturnType<typeof buildLessonLayout>;
  onLessonClick: (l: CalendarLesson) => void;
  onSlotClick: (startsLocal: string, endsLocal: string) => void;
  onOverflowClick?: () => void;
  onLessonDrop?: (lessonId: string, newStartLocal: string) => void;
  editable: boolean;
  fullDetail?: boolean;
}) {
  const dayKey = (() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
  })();

  function handleColumnClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!editable) return;
    // Ignore clicks that bubbled from a lesson card or chip.
    const target = e.target as HTMLElement;
    if (target.closest("[data-lesson-card]") || target.closest("[data-overflow-chip]")) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const slot = computeSlotFromOffset(offsetY, dayKey);
    onSlotClick(slot.startsLocal, slot.endsLocal);
  }

  // Drag-and-drop reschedule -----------------------------------------
  // We accept lesson cards being dropped anywhere inside the column.
  // dataTransfer carries: { lessonId, durationMin } so the drop handler
  // can preserve duration. preventDefault on dragOver enables the drop.
  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (!editable || !onLessonDrop) return;
    if (!e.dataTransfer.types.includes("application/x-hoofbeat-lesson")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    if (!editable || !onLessonDrop) return;
    const raw = e.dataTransfer.getData("application/x-hoofbeat-lesson");
    if (!raw) return;
    e.preventDefault();
    let payload: { lessonId: string; offsetWithinCard?: number };
    try { payload = JSON.parse(raw); } catch { return; }

    const rect = e.currentTarget.getBoundingClientRect();
    // Anchor the drop to where the *top* of the card lands, not the
    // cursor — feels closer to Google Calendar. We subtract the offset
    // the user grabbed inside the card from the cursor's Y position.
    const dropY  = e.clientY - rect.top - (payload.offsetWithinCard ?? 0);
    const slot   = computeSlotFromOffset(dropY, dayKey);
    onLessonDrop(payload.lessonId, slot.startsLocal);
  }

  return (
    // role=presentation: the column itself isn't a "button" — its
    // clickability is a sighted-mouse affordance for fast scheduling.
    // Keyboard users get to "+ New lesson" in the hero (and on mobile
    // via the FAB), which routes through the same prefill path.
    <div
      role="presentation"
      className={
        isToday
          ? "relative border-l border-ink-100 bg-brand-50/30 cursor-pointer"
          : "relative border-l border-ink-100 bg-white hover:bg-ink-100/20 cursor-pointer"
      }
      style={{ height: GRID_HEIGHT }}
      onClick={editable ? handleColumnClick : undefined}
      onDragOver={editable && onLessonDrop ? handleDragOver : undefined}
      onDrop={editable && onLessonDrop ? handleDrop : undefined}
    >
      {/* Hour separators ------------------------------------------- */}
      <HourSeparators />

      {/* Now-line — only on today's column ------------------------- */}
      {isToday && <NowLine />}

      {/* Lessons --------------------------------------------------- */}
      {layout.placed.map((p) => {
        const s = STATUS_STYLE[p.lesson.status];
        const widthPct = 100 / p.cols;
        const leftPct  = p.col * widthPct;
        const payment = p.lesson.payment_status;
        return (
          <button
            key={p.lesson.id}
            type="button"
            data-lesson-card
            draggable={editable && !!onLessonDrop}
            onDragStart={
              editable && onLessonDrop
                ? (e) => {
                    // Compute where in the card the user grabbed, so on
                    // drop we can anchor the new start to that offset.
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const offsetWithinCard = e.clientY - rect.top;
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData(
                      "application/x-hoofbeat-lesson",
                      JSON.stringify({ lessonId: p.lesson.id, offsetWithinCard }),
                    );
                  }
                : undefined
            }
            onClick={(e) => {
              e.stopPropagation();
              onLessonClick(p.lesson);
            }}
            aria-label={ariaLabelForLesson(p.lesson)}
            className={`absolute rounded-lg overflow-hidden text-left ${s.bg} ${s.border} ${s.dashed ? "border-dashed" : ""}
                        ${p.lesson.over_limit_reason ? "ring-1 ring-amber-300" : ""}
                        ${editable && onLessonDrop ? "cursor-grab active:cursor-grabbing" : ""}
                        hover:shadow-soft transition-shadow border-l-[3px] ${s.stripe}`}
            style={{
              top:    p.top,
              height: Math.max(p.height, 22),
              left:   `calc(${leftPct}% + 2px)`,
              width:  `calc(${widthPct}% - 4px)`,
            }}
          >
            {/* Tiny payment indicator — top-right corner. Uses one
                glyph + one tone so it reads at a glance even on a
                short 22px lesson. */}
            <PaymentDot status={payment} compact={p.height < 56} />

            {/* Welfare-override marker — only when this lesson runs the
                horse over its cap. Tiny amber triangle, top-left under
                the stripe, so it's visible but doesn't compete with
                the payment dot. */}
            {p.lesson.over_limit_reason && (
              <span
                aria-hidden
                title="Booked over horse welfare cap"
                className="absolute top-1 left-1.5 text-amber-600 text-[11px] leading-none select-none pointer-events-none"
              >
                ⚠
              </span>
            )}
            <div className={`h-full px-2 py-1.5 leading-tight ${fullDetail ? "" : "text-[11px]"}`}>
              <div className={`flex items-center gap-1 tabular-nums ${s.ink}`}>
                <span className="font-semibold">{fmtTime(p.lesson.starts_at)}</span>
                {p.height >= 32 && (
                  <>
                    <span className={s.meta}>–</span>
                    <span className={s.meta}>{fmtTime(p.lesson.ends_at)}</span>
                  </>
                )}
              </div>
              {p.height >= 30 && (
                <div className={`mt-0.5 truncate font-medium ${s.ink}`}>
                  {p.lesson.client?.full_name ?? "—"}
                </div>
              )}
              {p.height >= 56 && (
                <div className={`mt-0.5 truncate ${s.meta}`}>
                  {p.lesson.horse?.name ?? "—"}
                  {fullDetail ? ` · ${p.lesson.trainer?.full_name ?? "—"}` : ""}
                </div>
              )}
              {fullDetail && p.height >= 78 && (
                <div className="mt-1">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium ${s.pill} ${s.pillInk}`}>
                    {STATUS_LABEL[p.lesson.status]}
                  </span>
                </div>
              )}
            </div>
          </button>
        );
      })}

      {/* Overflow chip --------------------------------------------- */}
      {layout.overflow > 0 && onOverflowClick && (
        <button
          type="button"
          data-overflow-chip
          onClick={(e) => {
            e.stopPropagation();
            onOverflowClick();
          }}
          aria-label={`Show ${layout.overflow} more lessons on this day`}
          className="absolute bottom-1 left-1 right-1 rounded-md bg-navy-900/85 hover:bg-navy-900 text-white text-[10px] font-medium px-2 py-1 text-center"
        >
          +{layout.overflow} more
        </button>
      )}
    </div>
  );
}

// Build a screen-reader friendly label for a lesson card.
// Visible text already covers most of this, but a single `aria-label`
// reads cleaner than a stack of nested spans for assistive tech.
function ariaLabelForLesson(l: CalendarLesson): string {
  const start  = fmtTime(l.starts_at);
  const end    = fmtTime(l.ends_at);
  const client = l.client?.full_name ?? "no client";
  const horse  = l.horse?.name ?? "no horse";
  const status = l.status.replace("_", " ");
  const payment =
    l.payment_status === "package"  ? "covered by package" :
    l.payment_status === "paid"     ? "paid" :
    l.payment_status === "partial"  ? "partially paid" :
                                      "unpaid";
  const welfare = l.over_limit_reason ? ", over welfare cap" : "";
  return `Edit ${status} lesson, ${start} to ${end}, ${client}, ${horse}, ${payment}${welfare}`;
}

// Tiny payment indicator rendered top-right on each lesson card.
//
//   package   → brand "PKG" pill (or "P" when compact)
//   paid      → emerald check dot
//   partial   → amber half dot
//   unpaid    → ink hollow dot (low-emphasis, doesn't shout)
//
// `compact` uses a single character / dot so it reads on tiny lesson
// cards; non-compact gets a 2-char chip on roomy day-grid cards.
export function PaymentDot({
  status,
  compact = false,
}: {
  status: LessonPaymentStatus;
  compact?: boolean;
}) {
  // We position absolutely so the dot floats over the lesson body's
  // padded layout — the parent button has overflow:hidden so it
  // can't escape the rounded corners.
  const base = "absolute top-1 right-1 inline-flex items-center justify-center select-none pointer-events-none";

  if (status === "package") {
    return (
      <span
        className={`${base} rounded-md bg-brand-600 text-white text-[9px] font-bold leading-none tracking-wide ${
          compact ? "w-4 h-4" : "h-4 px-1.5"
        }`}
        aria-hidden
      >
        {compact ? "P" : "PKG"}
      </span>
    );
  }

  if (status === "paid") {
    return (
      <span
        className={`${base} rounded-full bg-emerald-600 text-white text-[10px] font-bold leading-none w-3.5 h-3.5`}
        aria-hidden
      >
        ✓
      </span>
    );
  }

  if (status === "partial") {
    return (
      <span
        className={`${base} rounded-full bg-amber-500 ring-2 ring-amber-200 w-2.5 h-2.5`}
        aria-hidden
      />
    );
  }

  // unpaid — show only on roomier cards so we don't clutter tiny ones.
  if (compact) return null;
  return (
    <span
      className={`${base} rounded-full border border-ink-300 bg-white w-2.5 h-2.5`}
      aria-hidden
    />
  );
}

function HourSeparators() {
  const sep = [];
  for (let h = HOUR_START + 1; h <= HOUR_END; h++) {
    sep.push(
      <div
        key={h}
        className="absolute left-0 right-0 border-t"
        style={{
          top: (h - HOUR_START) * HOUR_HEIGHT,
          borderColor: "rgba(28,26,23,0.06)",
        }}
      />,
    );
  }
  return <>{sep}</>;
}

function NowLine() {
  // Computed at render time so it always reflects current time. Avoid
  // ticking state — re-rendering the calendar every minute would be
  // overkill. The shell remounts on navigation anyway.
  const now = new Date();
  const minutes = (now.getHours() - HOUR_START) * 60 + now.getMinutes();
  if (minutes < 0 || minutes > (HOUR_END - HOUR_START) * 60) return null;
  const top = (minutes / 60) * HOUR_HEIGHT;
  return (
    <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top }}>
      <div className="relative">
        <span className="absolute -left-1 -top-[5px] w-2.5 h-2.5 rounded-full bg-brand-600 ring-2 ring-white" />
        <div className="border-t-2 border-brand-500" />
      </div>
    </div>
  );
}
