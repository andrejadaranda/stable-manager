// Personal / Google calendar event types + display tokens.
// Safe to import from "use client" components (no server deps).
//
// A "personal event" here is any per-user event shown on the unified
// calendar that is NOT a stable lesson/farrier/block: events the user
// creates in Longrein, and events imported from their Google calendars.
// Both live in the calendar_personal_events table, discriminated by
// `source`.

export type PersonalEventType =
  | "personal"
  | "work"
  | "family"
  | "travel"
  | "appointment"
  | "other";

export type EventSource = "longrein" | "google";

export type CalendarPersonalEvent = {
  id: string;
  title: string;
  event_type: PersonalEventType;
  starts_at: string; // ISO
  ends_at: string; // ISO
  all_day: boolean;
  notes: string | null;
  location: string | null;
  color: string | null; // optional hex override
  source: EventSource;
  sync_to_google: boolean;
  recurrence: string[] | null;
  // Google linkage (present when source==='google')
  google_calendar_id: string | null;
  google_event_id: string | null;
  google_html_link?: string | null;
  calendar_name?: string | null; // the Google calendar's summary (e.g. "Familija")
  // discriminator so grids can tell this apart from lessons/farrier
  event_source: "personal_event";
};

// Per-type color (hex — used as inline style so Tailwind's purge can't drop it).
export const EVENT_TYPE_META: Record<PersonalEventType, { label: string; hex: string }> = {
  personal:    { label: "Personal",    hex: "#6366f1" }, // indigo
  work:        { label: "Work",        hex: "#d97706" }, // amber
  family:      { label: "Family",      hex: "#059669" }, // emerald
  travel:      { label: "Travel",      hex: "#0284c7" }, // sky
  appointment: { label: "Appointment", hex: "#7c3aed" }, // violet
  other:       { label: "Other",       hex: "#64748b" }, // slate
};

/** Violet is the default accent for Google-imported events (🟪). */
export const GOOGLE_DEFAULT_HEX = "#7c3aed";

/** The accent hex for an event: explicit override → Google calendar color →
 *  per-type color. Google-sourced events read as one family (violet) unless
 *  Google gave us the calendar's own color. */
export function eventHex(ev: CalendarPersonalEvent): string {
  if (ev.color) return ev.color;
  if (ev.source === "google") return GOOGLE_DEFAULT_HEX;
  return EVENT_TYPE_META[ev.event_type]?.hex ?? EVENT_TYPE_META.other.hex;
}

/** True when the event crosses local midnight (a night shift, 22:00→06:00). */
export function isOvernight(ev: { starts_at: string; ends_at: string; all_day: boolean }): boolean {
  if (ev.all_day) return false;
  const s = new Date(ev.starts_at);
  const e = new Date(ev.ends_at);
  return s.getFullYear() !== e.getFullYear() || s.getMonth() !== e.getMonth() || s.getDate() !== e.getDate();
}

/** A single day's slice of an event (an overnight shift becomes two slices,
 *  one on each day). Minutes are local-minutes-from-midnight [0..1440]. */
export type EventSegment = {
  event: CalendarPersonalEvent;
  dayKey: string; // YYYY-MM-DD
  startMin: number; // 0 when the event started on an earlier day
  endMin: number; // 1440 when it continues into the next day
  continuesUp: boolean; // started before this day (→ 00:00)
  continuesDown: boolean; // continues past this day (→ next day)
};

function dayKeyOf(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Split one event into per-day segments across the local days it touches.
 * This is what makes an overnight shift (22:00→06:00) render as a band on
 * BOTH days with the correct time range on each — and drives correct
 * same-day conflict detection for the 00:00–06:00 portion.
 */
export function segmentEvent(ev: CalendarPersonalEvent): EventSegment[] {
  if (ev.all_day) {
    return [{ event: ev, dayKey: dayKeyOf(new Date(ev.starts_at)), startMin: 0, endMin: 1440, continuesUp: false, continuesDown: false }];
  }
  const start = new Date(ev.starts_at);
  const end = new Date(ev.ends_at);
  const segments: EventSegment[] = [];

  // Walk each local calendar day from start to end.
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const lastDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  // An event ending exactly at 00:00 belongs to the previous day only.
  const endIsMidnight = end.getHours() === 0 && end.getMinutes() === 0;

  while (cursor <= lastDay) {
    const key = dayKeyOf(cursor);
    const isFirst = cursor.getTime() === new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const isLast = cursor.getTime() === lastDay.getTime();

    if (isLast && endIsMidnight && !isFirst) break; // 00:00 end — no sliver on the final day

    const startMin = isFirst ? start.getHours() * 60 + start.getMinutes() : 0;
    const endMin = isLast ? (endIsMidnight ? 1440 : end.getHours() * 60 + end.getMinutes()) : 1440;

    segments.push({
      event: ev,
      dayKey: key,
      startMin,
      endMin,
      continuesUp: !isFirst,
      continuesDown: !isLast,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return segments;
}
