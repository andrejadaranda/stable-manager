// Minimal week math. ISO weeks (Monday-start).

export function startOfWeek(d: Date): Date {
  const monday = new Date(d);
  const dow = monday.getDay();              // 0=Sun .. 6=Sat
  const diff = dow === 0 ? -6 : 1 - dow;    // shift back to Monday
  monday.setDate(monday.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

// LOCAL YYYY-MM-DD. Used for bucketing lessons into day cells and for
// URL params; both must agree, so we render in the user's local zone.
export function fmtISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Single source of truth for the app's display timezone. Times are stored
// in UTC; everything user-facing renders in Vilnius local time. Formatting
// with an explicit timeZone (instead of the runtime default) is what keeps
// SERVER-rendered times correct — without it, server components on Vercel
// (UTC) showed lessons 3h early in summer (e.g. a 12:00 lesson as 09:00).
// A fixed locale + tz also means server and client render identically (no
// hydration drift).
export const APP_TIME_ZONE = "Europe/Vilnius";

export function fmtDayLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "short", month: "short", day: "numeric",
    timeZone: APP_TIME_ZONE,
  });
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,                 // 24h — LT convention; also drops the stray AM/PM
    timeZone: APP_TIME_ZONE,
  });
}
