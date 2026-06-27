"use client";

// Month overview — a 6-week grid of the month containing `gridStart`.
// Each day shows ALL its lessons (colored by status) + farrier/vet chips.
// A lesson chip is tappable → opens Edit lesson right here (Andrėja wants
// to edit straight from the month). The day number links into that week
// for booking. Client component so the edit dialog can live inline.

import { useState } from "react";
import Link from "next/link";
import { fmtISODate, addDays } from "@/lib/utils/dates";
import type { CalendarLesson } from "@/services/lessons";
import type { CalendarFarrierVisit } from "@/services/farrierVisits.pure";
import { VISIT_KIND_COLOR } from "@/services/farrierVisits.pure";
import type { AvailabilityBlock } from "@/services/availability.pure";
import type { ServiceRow } from "@/services/services";
import type { PackageSummaryRow } from "@/services/packages";
import { EditLessonDialog } from "./edit-lesson-dialog";

const STATUS_COLOR: Record<CalendarLesson["status"], string> = {
  scheduled: "#2F406A",
  completed: "#5A7A3A",
  cancelled: "#B0A89E",
  no_show:   "#B23838",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type ActivePackagesMap = Record<string, PackageSummaryRow>;

export function MonthView({
  lessons,
  farrierVisits,
  blocks = [],
  gridStart,
  monthIndex,
  monthLabel,
  basePath,
  prevDate,
  nextDate,
  clients = [],
  horses = [],
  services = [],
  arenas = [],
  activePackagesByClient = {},
  editable = false,
}: {
  lessons: CalendarLesson[];
  farrierVisits: CalendarFarrierVisit[];
  blocks?: AvailabilityBlock[];
  gridStart: Date;
  /** 0-11 month the grid is "about" — days outside it are dimmed. */
  monthIndex: number;
  monthLabel: string;
  basePath: string;
  prevDate: string;
  nextDate: string;
  clients?: Array<{ id: string; full_name: string }>;
  horses?: Array<{ id: string; name: string }>;
  services?: ServiceRow[];
  arenas?: Array<{ id: string; name: string; color: string }>;
  activePackagesByClient?: ActivePackagesMap;
  editable?: boolean;
}) {
  const [selected, setSelected] = useState<CalendarLesson | null>(null);

  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const todayKey = fmtISODate(new Date());

  const blocksByDay = new Map<string, AvailabilityBlock[]>();
  for (const bl of blocks) {
    const k = fmtISODate(new Date(bl.starts_at));
    const arr = blocksByDay.get(k);
    if (arr) arr.push(bl);
    else blocksByDay.set(k, [bl]);
  }

  const lessonsByDay = new Map<string, CalendarLesson[]>();
  for (const l of lessons) {
    const k = fmtISODate(new Date(l.starts_at));
    const arr = lessonsByDay.get(k);
    if (arr) arr.push(l);
    else lessonsByDay.set(k, [l]);
  }
  const careByDay = new Map<string, CalendarFarrierVisit[]>();
  for (const v of farrierVisits) {
    const k = fmtISODate(new Date(v.starts_at));
    const arr = careByDay.get(k);
    if (arr) arr.push(v);
    else careByDay.set(k, [v]);
  }
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Vilnius" });

  return (
    <div className="flex flex-col gap-3">
      {/* Header: month + nav + week toggle */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Link href={`${basePath}?view=month&date=${prevDate}`} aria-label="Previous month"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-ink-600 hover:bg-ink-100">‹</Link>
          <h2 className="text-lg font-semibold text-ink-900 min-w-[150px] text-center">{monthLabel}</h2>
          <Link href={`${basePath}?view=month&date=${nextDate}`} aria-label="Next month"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-ink-600 hover:bg-ink-100">›</Link>
        </div>
        <Link href={`${basePath}?date=${todayKey}`}
          className="h-9 px-3 inline-flex items-center rounded-lg text-[13px] font-medium text-brand-700 bg-brand-50 hover:bg-brand-100">
          Week view
        </Link>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-px text-[11px] uppercase tracking-[0.06em] text-ink-400">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-1 text-center">{d}</div>
        ))}
      </div>

      {/* 6×7 grid */}
      <div className="grid grid-cols-7 gap-px bg-ink-100 rounded-xl overflow-hidden border border-ink-100">
        {days.map((day) => {
          const key = fmtISODate(day);
          const inMonth = day.getMonth() === monthIndex;
          const dayLessons = (lessonsByDay.get(key) ?? []).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
          const dayCare = careByDay.get(key) ?? [];
          const dayBlocks = blocksByDay.get(key) ?? [];
          const hasAllDayBlock = dayBlocks.some((b) => b.all_day);
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              className={`min-h-[92px] md:min-h-[110px] p-1.5 flex flex-col gap-1 ${hasAllDayBlock ? "bg-rose-50" : "bg-white"} ${inMonth ? "" : "opacity-45"}`}
            >
              {/* Day number — links into that week for booking. */}
              <Link
                href={`${basePath}?date=${key}`}
                className={`self-start text-[12px] font-medium w-6 h-6 inline-flex items-center justify-center rounded-full hover:ring-1 hover:ring-brand-300 ${isToday ? "bg-brand-600 text-white" : hasAllDayBlock ? "text-rose-700" : "text-ink-700"}`}
                title="Open this week"
              >
                {day.getDate()}
              </Link>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayBlocks.map((b) => (
                  <span key={b.id} className="text-[10.5px] leading-tight truncate px-1 py-0.5 rounded font-medium"
                    style={{ background: "#B238381A", color: "#B23838" }}>
                    {b.all_day ? "Blocked" : `${time(b.starts_at)}–${time(b.ends_at)} blocked`}{b.reason ? ` · ${b.reason}` : ""}
                  </span>
                ))}
                {dayLessons.map((l) =>
                  editable ? (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setSelected(l)}
                      className="text-left text-[10.5px] leading-tight truncate px-1 py-0.5 rounded hover:ring-1 hover:ring-inset"
                      style={{ background: `${STATUS_COLOR[l.status]}1A`, color: STATUS_COLOR[l.status] }}
                      title="Edit lesson"
                    >
                      {time(l.starts_at)} {l.client?.full_name ?? l.horse?.name ?? "Lesson"}
                    </button>
                  ) : (
                    <span key={l.id} className="text-[10.5px] leading-tight truncate px-1 py-0.5 rounded"
                      style={{ background: `${STATUS_COLOR[l.status]}1A`, color: STATUS_COLOR[l.status] }}>
                      {time(l.starts_at)} {l.client?.full_name ?? l.horse?.name ?? "Lesson"}
                    </span>
                  ),
                )}
                {dayCare.map((v) => (
                  <span key={v.id} className="text-[10.5px] leading-tight truncate px-1 py-0.5 rounded text-white"
                    style={{ background: VISIT_KIND_COLOR[v.kind] ?? VISIT_KIND_COLOR.farrier }}>
                    {v.kind === "vet" ? "Vet" : "Farrier"}{v.farrier_name ? ` · ${v.farrier_name}` : ""}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit modal — same dialog the week view uses. */}
      {editable && selected && (
        <EditLessonDialog
          key={selected.id}
          lesson={selected}
          services={services}
          activePackage={activePackagesByClient[selected.client?.id ?? ""] ?? null}
          clients={clients}
          horses={horses}
          arenas={arenas}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
