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

export function fmtDayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
