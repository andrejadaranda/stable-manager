// Compatibility shim — the old WeekView (cards-per-day) was replaced by
// CalendarShell on 2026-04-28. Existing imports keep resolving so any
// pages still pointing here render the new grid without code changes.
//
// Prefer importing CalendarShell directly in new code.

export { CalendarShell as WeekView } from "./calendar-shell";
