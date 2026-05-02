"use client";

// Calendar shell — top-level orchestrator for the schedule view.
//
// Replaces the old card-per-day grid (which read like a to-do list) with a
// real time-grid calendar:
//   * Desktop ≥ md: WeekGrid (7-column time grid) or DayGrid (single column).
//   * Mobile <  md: DayAgenda (pill picker + chronological list).
//
// State that lives here (not in the URL):
//   * `view`     — "week" | "day"   (desktop toggle)
//   * `dayKey`   — selected day for day view / mobile (YYYY-MM-DD)
//   * `slot`     — pending click-to-create payload (start/end in local time)
//   * `selected` — the lesson currently being edited
//
// Week boundaries (?date=…) stay in the URL so a shared link reproduces
// the same week. Day selection stays client-side so toggling between
// views is instant and doesn't trigger server round trips.

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays, fmtISODate } from "@/lib/utils/dates";
import type { CalendarLesson } from "@/services/lessons";
import type { PackageSummaryRow } from "@/services/packages";
import type { ServiceRow } from "@/services/services";
import { CreateLessonForm } from "./create-lesson-form";
import { EditLessonDialog } from "./edit-lesson-dialog";
import { WeekGrid } from "./week-grid";
import { DayGrid } from "./day-grid";
import { DayAgenda } from "./day-agenda";
import { rescheduleLessonAction } from "@/app/dashboard/calendar/reschedule-action";

type ClientOpt  = { id: string; full_name: string; default_lesson_price?: number | null };
type HorseOpt   = { id: string; name: string };
type TrainerOpt = { id: string; full_name: string | null; role: string };

export type ActivePackagesMap = Record<string, PackageSummaryRow>;

type Slot = { startsLocal: string; endsLocal: string };

export function CalendarShell({
  lessons,
  weekStart,
  basePath,
  clients = [],
  horses = [],
  trainers = [],
  services = [],
  activePackagesByClient = {},
  editable = true,
}: {
  lessons: CalendarLesson[];
  weekStart: Date;
  basePath: string;
  /** Required when editable. Optional for read-only views. */
  clients?: ClientOpt[];
  horses?: HorseOpt[];
  trainers?: TrainerOpt[];
  /** Active services from the stable price list. */
  services?: ServiceRow[];
  /** {clientId -> active package} for the "Use package" toggle. */
  activePackagesByClient?: ActivePackagesMap;
  editable?: boolean;
}) {
  const todayKey = fmtISODate(new Date());
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const weekKeys = days.map(fmtISODate);

  // Default selected day: today if it falls in this week, else Monday.
  const initialDayKey = weekKeys.includes(todayKey) ? todayKey : weekKeys[0];

  const router = useRouter();

  const [view,    setView]    = useState<"week" | "day">("week");
  const [dayKey,  setDayKey]  = useState<string>(initialDayKey);
  const [slot,    setSlot]    = useState<Slot | null>(null);
  const [selected, setSelected] = useState<CalendarLesson | null>(null);

  // Optimistic overrides: lessonId → new starts/ends. Cleared after
  // server reconciliation via router.refresh(). Server-truth re-arrives
  // through the lessons prop on the next render.
  const [optimistic, setOptimistic] = useState<Record<string, { starts_at: string; ends_at: string }>>({});
  const [, startTransition] = useTransition();
  const [dropError, setDropError] = useState<string | null>(null);

  // Read-only callers (clients in /dashboard/my-lessons) get a horse
  // preview navigation when they tap a lesson; staff get the editor.
  function handleLessonClick(l: CalendarLesson) {
    if (editable) {
      setSelected(l);
    } else if (l.horse?.id) {
      router.push(`/dashboard/my-horses/${l.horse.id}`);
    }
  }

  const prev = fmtISODate(addDays(weekStart, -7));
  const next = fmtISODate(addDays(weekStart,  7));

  // Range label — e.g. "Apr 28 – May 4, 2026".
  const rangeLabel = useMemo(() => {
    const a = days[0];
    const b = days[6];
    const sameMonth = a.getMonth() === b.getMonth();
    const fmtA = a.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const fmtB = sameMonth
      ? b.toLocaleDateString(undefined, { day: "numeric" })
      : b.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const year = b.getFullYear();
    return `${fmtA} – ${fmtB}, ${year}`;
  }, [days]);

  // Lessons grouped by local day key — each grid only re-buckets when
  // the lesson list (or optimistic overlay) actually changes. The
  // overlay shifts a lesson to its dragged position before the server
  // round-trip lands, so the card "sticks" where the user dropped it.
  const visibleLessons = useMemo(() => {
    if (Object.keys(optimistic).length === 0) return lessons;
    return lessons.map((l) => {
      const o = optimistic[l.id];
      if (!o) return l;
      return { ...l, starts_at: o.starts_at, ends_at: o.ends_at };
    });
  }, [lessons, optimistic]);

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarLesson[]>();
    for (const l of visibleLessons) {
      const k = fmtISODate(new Date(l.starts_at));
      const arr = m.get(k) ?? [];
      arr.push(l);
      m.set(k, arr);
    }
    return m;
  }, [visibleLessons]);

  /** Drag-and-drop reschedule. The week grid passes a snapped local
   *  start string ("YYYY-MM-DDTHH:mm"); we preserve duration and submit. */
  function handleLessonDrop(lessonId: string, newStartLocal: string) {
    const lesson = lessons.find((l) => l.id === lessonId);
    if (!lesson) return;
    const original = new Date(lesson.starts_at);
    const originalEnd = new Date(lesson.ends_at);
    const durMs = originalEnd.getTime() - original.getTime();
    const newStart = parseLocal(newStartLocal);
    const newEnd   = new Date(newStart.getTime() + durMs);

    // Optimistic flip
    setDropError(null);
    setOptimistic((prev) => ({
      ...prev,
      [lessonId]: {
        starts_at: newStart.toISOString(),
        ends_at:   newEnd.toISOString(),
      },
    }));

    startTransition(async () => {
      const fd = new FormData();
      fd.set("lesson_id", lessonId);
      fd.set("starts_at", newStartLocal);
      fd.set("ends_at",   toLocalInput(newEnd));
      const res = await rescheduleLessonAction(fd);
      if (!res.ok) {
        setDropError(res.error);
        // Revert overlay so card snaps back
        setOptimistic((prev) => {
          const { [lessonId]: _, ...rest } = prev;
          return rest;
        });
        return;
      }
      router.refresh();
      // Clear after a tick so the refreshed lessons reach us first.
      setTimeout(() => {
        setOptimistic((prev) => {
          const { [lessonId]: _, ...rest } = prev;
          return rest;
        });
      }, 600);
    });
  }

  // Click on an empty grid cell — open the create form prefilled.
  function handleCreateAt(startsLocal: string, endsLocal: string) {
    if (!editable) return;
    setSlot({ startsLocal, endsLocal });
  }

  // Click a day header in week view — switch to that day's detail.
  function handleExpandDay(key: string) {
    setDayKey(key);
    setView("day");
  }

  return (
    <div className="flex flex-col gap-5">
      <CalendarHero
        rangeLabel={rangeLabel}
        view={view}
        onViewChange={setView}
        prevHref={`${basePath}?date=${prev}`}
        nextHref={`${basePath}?date=${next}`}
        todayHref={`${basePath}?date=${todayKey}`}
        showCreate={editable}
        onCreate={() => {
          // Seed using the currently focused day. In week view that's the
          // dayKey default (today if visible, else Monday). In day view
          // it's whatever the user has selected.
          const seed = seedSlotForDay(dayKey);
          handleCreateAt(seed.startsLocal, seed.endsLocal);
        }}
      />

      {/* Drag-error toast (banner) — clears on next successful reschedule */}
      {dropError && (
        <div
          role="alert"
          className="rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[13px] px-4 py-2.5 flex items-center justify-between gap-3"
        >
          <span>{dropError}</span>
          <button
            type="button"
            onClick={() => setDropError(null)}
            className="text-rose-600 hover:text-rose-800 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Desktop views ----------------------------------------------- */}
      <div className="hidden md:block">
        {view === "week" ? (
          <WeekGrid
            days={days}
            weekKeys={weekKeys}
            todayKey={todayKey}
            byDay={byDay}
            onLessonClick={handleLessonClick}
            onSlotClick={handleCreateAt}
            onDayHeaderClick={handleExpandDay}
            onLessonDrop={editable ? handleLessonDrop : undefined}
            editable={editable}
          />
        ) : (
          <DayGrid
            day={days[Math.max(0, weekKeys.indexOf(dayKey))] ?? days[0]}
            dayKey={dayKey}
            todayKey={todayKey}
            lessons={byDay.get(dayKey) ?? []}
            onLessonClick={handleLessonClick}
            onSlotClick={handleCreateAt}
            onLessonDrop={editable ? handleLessonDrop : undefined}
            onBack={() => setView("week")}
            dayPicker={
              <DayPickerPills
                days={days}
                weekKeys={weekKeys}
                todayKey={todayKey}
                selectedKey={dayKey}
                onSelect={setDayKey}
              />
            }
            editable={editable}
          />
        )}
      </div>

      {/* Mobile view -------------------------------------------------- */}
      <div className="md:hidden">
        <DayAgenda
          days={days}
          weekKeys={weekKeys}
          todayKey={todayKey}
          selectedKey={dayKey}
          onSelectDay={setDayKey}
          lessons={byDay.get(dayKey) ?? []}
          onLessonClick={handleLessonClick}
          onCreate={() => {
            // Mobile FAB: open form prefilled to selected day at next
            // 15-min mark in the future (or 09:00 if the day is in the past).
            setSlot(seedSlotForDay(dayKey));
          }}
          editable={editable}
        />
      </div>

      {/* Create modal ------------------------------------------------ */}
      {slot && (
        <CreateLessonForm
          clients={clients}
          horses={horses}
          trainers={trainers}
          services={services}
          activePackagesByClient={activePackagesByClient}
          onClose={() => setSlot(null)}
          initial={slot.startsLocal ? slot : undefined}
        />
      )}

      {/* Edit modal -------------------------------------------------- */}
      {editable && selected && (
        <EditLessonDialog
          key={selected.id}
          lesson={selected}
          services={services}
          activePackage={activePackagesByClient[selected.client?.id ?? ""] ?? null}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// =============================================================
// Hero
// =============================================================
function CalendarHero({
  rangeLabel,
  view,
  onViewChange,
  prevHref,
  nextHref,
  todayHref,
  onCreate,
  showCreate,
}: {
  rangeLabel: string;
  view: "week" | "day";
  onViewChange: (v: "week" | "day") => void;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  onCreate: () => void;
  showCreate: boolean;
}) {
  return (
    <div className="flex items-end justify-between flex-wrap gap-4">
      <div className="flex flex-col gap-1.5 min-w-0">
        <h1 className="font-display text-3xl md:text-4xl text-navy-900 leading-none">
          Calendar
        </h1>
        <span className="text-sm text-ink-500 font-medium tabular-nums">
          {rangeLabel}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* View toggle — desktop only. Mobile is always day-agenda. */}
        <div
          className="hidden md:inline-flex bg-white rounded-xl p-1 shadow-soft"
          role="group"
          aria-label="Calendar view"
        >
          <ToggleButton active={view === "week"} onClick={() => onViewChange("week")}>
            Week
          </ToggleButton>
          <ToggleButton active={view === "day"} onClick={() => onViewChange("day")}>
            Day
          </ToggleButton>
        </div>

        <div className="inline-flex items-center gap-1.5">
          <NavLink href={prevHref} ariaLabel="Previous week">←</NavLink>
          <NavLink href={todayHref}>Today</NavLink>
          <NavLink href={nextHref} ariaLabel="Next week">→</NavLink>
        </div>

        {showCreate && (
          <>
            <Link
              href="/dashboard/calendar/print"
              className="
                hidden md:inline-flex items-center justify-center gap-1.5
                h-10 px-3.5 rounded-xl text-sm font-medium
                bg-white text-ink-700 shadow-soft hover:shadow-lift
                transition-shadow
              "
              aria-label="Print this week's schedule"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
              </svg>
              Print
            </Link>
            <button
              type="button"
              onClick={onCreate}
              className="
                inline-flex items-center justify-center gap-1.5
                h-10 px-4 rounded-xl text-sm font-medium
                bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800
                transition-colors
              "
            >
              + New lesson
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  // h-9 inside an h-10 toggle group (1px padding each side): the outer
  // group reads as a single 40px control aligned with the CTA and nav,
  // while each pill is 36px — matches the bumped touch target ergonomics.
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "h-9 px-4 rounded-lg text-sm font-semibold bg-navy-900 text-white"
          : "h-9 px-4 rounded-lg text-sm font-medium text-ink-600 hover:text-navy-900"
      }
    >
      {children}
    </button>
  );
}

function NavLink({
  href,
  ariaLabel,
  children,
}: {
  href: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="px-3.5 h-10 inline-flex items-center rounded-xl bg-white text-sm font-medium text-ink-700 hover:text-ink-900 shadow-soft hover:shadow-lift transition-shadow"
    >
      {children}
    </Link>
  );
}

// =============================================================
// Day picker pills (used inside DayGrid)
// =============================================================
function DayPickerPills({
  days,
  weekKeys,
  todayKey,
  selectedKey,
  onSelect,
}: {
  days: Date[];
  weekKeys: string[];
  todayKey: string;
  selectedKey: string;
  onSelect: (k: string) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
      {days.map((d, i) => {
        const k        = weekKeys[i];
        const isToday  = k === todayKey;
        const isActive = k === selectedKey;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onSelect(k)}
            className={
              isActive
                ? "shrink-0 inline-flex flex-col items-center justify-center h-14 min-w-[48px] px-3 rounded-xl bg-navy-900 text-white"
                : isToday
                ? "shrink-0 inline-flex flex-col items-center justify-center h-14 min-w-[48px] px-3 rounded-xl bg-brand-50 text-brand-700 hover:bg-brand-100"
                : "shrink-0 inline-flex flex-col items-center justify-center h-14 min-w-[48px] px-3 rounded-xl bg-white text-ink-700 hover:text-navy-900 shadow-soft"
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
  );
}

// =============================================================
// Helpers
// =============================================================
function seedSlotForDay(dayKey: string): Slot {
  // Returns a starts/ends pair in "YYYY-MM-DDTHH:mm" local format,
  // snapped to the next 15-minute mark from now if dayKey is today,
  // otherwise 09:00 on that day.
  const now = new Date();
  const todayKey = fmtISODate(now);
  const isToday = dayKey === todayKey;

  let d: Date;
  if (isToday) {
    d = new Date(now);
    d.setSeconds(0, 0);
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15);
  } else {
    const [y, m, day] = dayKey.split("-").map(Number);
    d = new Date(y, m - 1, day, 9, 0, 0, 0);
  }

  const startsLocal = toLocalInput(d);
  const ends = new Date(d);
  ends.setMinutes(ends.getMinutes() + 45);
  const endsLocal = toLocalInput(ends);
  return { startsLocal, endsLocal };
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseLocal(local: string): Date {
  // Parses "YYYY-MM-DDTHH:mm" as a *local* time (not UTC). new Date(s)
  // would treat ISO with no zone as UTC in some engines, so we split.
  const [date, time] = local.split("T");
  const [y, m, d]    = date.split("-").map(Number);
  const [hh, mm]     = (time ?? "00:00").split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
}
