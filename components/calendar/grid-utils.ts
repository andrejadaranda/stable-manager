// Pure layout math + style tokens for the calendar grid.
//
// Kept in its own file so it can be unit-tested without React in scope,
// and so both WeekGrid and DayGrid share one source of truth.

import type { CalendarLesson } from "@/services/lessons";

// ---------- grid dimensions -------------------------------------

/** First hour shown on the rail (24h). */
export const HOUR_START = 7;
/** Last hour shown on the rail. The bottom edge of the grid is HOUR_END:00. */
export const HOUR_END   = 21;
/** Pixel height per hour in the desktop grid. */
export const HOUR_HEIGHT = 64;
/** Click-to-create snap, in minutes. */
export const SNAP_MIN = 15;
/** Total grid body height. */
export const GRID_HEIGHT = (HOUR_END - HOUR_START) * HOUR_HEIGHT;
/** Max columns for concurrent lessons before we start overflowing. */
export const MAX_VISIBLE_CONCURRENT = 4;

// ---------- placed lesson type ----------------------------------

export type PlacedLesson = {
  lesson: CalendarLesson;
  /** Pixel offset from the top of the grid. */
  top: number;
  /** Pixel height. */
  height: number;
  /** Column index within its overlap cluster (0-based). */
  col: number;
  /** Number of columns the lesson's cluster splits into. */
  cols: number;
};

export type DayLayout = {
  placed: PlacedLesson[];
  /** Lessons hidden because their cluster exceeded MAX_VISIBLE_CONCURRENT. */
  overflow: number;
};

// ---------- layout math -----------------------------------------

/**
 * Build a column-packed layout for a single day's lessons.
 *
 * Algorithm
 *   1. Sort by start time.
 *   2. Walk the list and group into clusters where each item overlaps at
 *      least one other in the cluster. Greedy is enough for our scale.
 *   3. Within a cluster, assign each lesson the lowest column index that
 *      doesn't collide with an already-placed lesson in the same column.
 *   4. The cluster's `cols` is the max column index + 1.
 *   5. If `cols` exceeds MAX_VISIBLE_CONCURRENT, the extra lessons are
 *      counted as overflow rather than rendered. The "+N more" chip in
 *      the column lets the user expand the day.
 */
export function buildLessonLayout(lessons: CalendarLesson[]): DayLayout {
  if (lessons.length === 0) return { placed: [], overflow: 0 };

  // Defensive: filter out malformed entries.
  const sorted = [...lessons]
    .filter((l) => l.starts_at && l.ends_at)
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));

  const placed: PlacedLesson[] = [];
  let overflow = 0;

  // Cluster lessons by transitive overlap.
  let cluster: CalendarLesson[] = [];
  let clusterEnd = 0;

  function flushCluster() {
    if (cluster.length === 0) return;
    const items = cluster;
    cluster = [];
    clusterEnd = 0;

    // Column assignment within the cluster.
    type Slot = { endMs: number };
    const cols: Slot[] = [];
    type Assign = { lesson: CalendarLesson; col: number };
    const assignments: Assign[] = [];
    for (const l of items) {
      const startMs = +new Date(l.starts_at);
      const endMs   = +new Date(l.ends_at);
      let chosen = -1;
      for (let i = 0; i < cols.length; i++) {
        if (cols[i].endMs <= startMs) { chosen = i; break; }
      }
      if (chosen === -1) {
        cols.push({ endMs });
        chosen = cols.length - 1;
      } else {
        cols[chosen].endMs = endMs;
      }
      assignments.push({ lesson: l, col: chosen });
    }

    const visibleCols = Math.min(cols.length, MAX_VISIBLE_CONCURRENT);

    for (const a of assignments) {
      if (a.col >= MAX_VISIBLE_CONCURRENT) {
        overflow += 1;
        continue;
      }
      const { top, height } = positionFor(a.lesson);
      placed.push({
        lesson: a.lesson,
        top,
        height,
        col: a.col,
        cols: visibleCols,
      });
    }
  }

  for (const l of sorted) {
    const startMs = +new Date(l.starts_at);
    const endMs   = +new Date(l.ends_at);
    if (cluster.length === 0 || startMs < clusterEnd) {
      cluster.push(l);
      clusterEnd = Math.max(clusterEnd, endMs);
    } else {
      flushCluster();
      cluster.push(l);
      clusterEnd = endMs;
    }
  }
  flushCluster();

  return { placed, overflow };
}

/** Pixel position for a lesson within the day grid. Clamps off-grid times
 *  to the visible window so a typo (e.g. lesson at 03:00) still renders
 *  somewhere visible rather than vanishing.
 */
function positionFor(l: CalendarLesson): { top: number; height: number } {
  const start = new Date(l.starts_at);
  const end   = new Date(l.ends_at);

  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin   = end.getHours()   * 60 + end.getMinutes();

  // If the lesson spans midnight (rare, but keep the math safe), cap at end of grid.
  const adjustedEndMin = endMin <= startMin ? (HOUR_END * 60) : endMin;

  const gridStartMin = HOUR_START * 60;
  const gridEndMin   = HOUR_END   * 60;

  const clampedStart = Math.max(startMin, gridStartMin);
  const clampedEnd   = Math.min(adjustedEndMin, gridEndMin);

  const top    = ((clampedStart - gridStartMin) / 60) * HOUR_HEIGHT;
  const height = Math.max(((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT, 22);

  return { top, height };
}

// ---------- click-to-create -------------------------------------

/**
 * Convert a vertical click offset (in pixels) to a 15-min-snapped local
 * datetime string for the supplied day. Defaults to a 45-minute end.
 */
export function computeSlotFromOffset(
  offsetY: number,
  dayKey: string, // YYYY-MM-DD
  durationMin = 45,
): { startsLocal: string; endsLocal: string } {
  const totalMinutes = (offsetY / HOUR_HEIGHT) * 60 + HOUR_START * 60;
  const snapped = Math.max(
    HOUR_START * 60,
    Math.min(
      HOUR_END * 60 - SNAP_MIN,
      Math.round(totalMinutes / SNAP_MIN) * SNAP_MIN,
    ),
  );

  const [y, m, d] = dayKey.split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  start.setMinutes(snapped);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + durationMin);

  return { startsLocal: toLocalInput(start), endsLocal: toLocalInput(end) };
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------- status styling --------------------------------------

export const STATUS_STYLE: Record<
  CalendarLesson["status"],
  {
    stripe: string; bg: string; ink: string; meta: string;
    pill: string; pillInk: string; border: string; dashed: boolean;
  }
> = {
  scheduled: {
    stripe:  "border-l-brand-600",
    bg:      "bg-white hover:bg-brand-50/40",
    ink:     "text-navy-900",
    meta:    "text-ink-500",
    pill:    "bg-brand-50",
    pillInk: "text-brand-700",
    border:  "border border-ink-100",
    dashed:  false,
  },
  completed: {
    stripe:  "border-l-emerald-600",
    bg:      "bg-emerald-50/60 hover:bg-emerald-50",
    ink:     "text-emerald-900",
    meta:    "text-emerald-700",
    pill:    "bg-emerald-100",
    pillInk: "text-emerald-700",
    border:  "border border-emerald-100",
    dashed:  false,
  },
  cancelled: {
    stripe:  "border-l-ink-400",
    bg:      "bg-ink-100/40 hover:bg-ink-100/60",
    ink:     "text-ink-600 line-through",
    meta:    "text-ink-500",
    pill:    "bg-ink-100",
    pillInk: "text-ink-700",
    border:  "border border-ink-200",
    dashed:  true,
  },
  no_show: {
    stripe:  "border-l-rose-600",
    bg:      "bg-rose-50/60 hover:bg-rose-50",
    ink:     "text-rose-900",
    meta:    "text-rose-700",
    pill:    "bg-rose-100",
    pillInk: "text-rose-700",
    border:  "border border-rose-100",
    dashed:  false,
  },
};

export const STATUS_LABEL: Record<CalendarLesson["status"], string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show:   "No-show",
};
