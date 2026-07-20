// Minimal, dependency-free iCalendar (.ics) reader for the "import" direction:
// we subscribe to someone else's calendar (e.g. a spouse's work calendar) and
// turn its events into busy windows so Longrein won't book lessons over them.
//
// Scope is deliberately pragmatic — it covers the shapes real work/shared
// calendars emit:
//   • DTSTART/DTEND in UTC (…Z), with TZID=…, floating, or VALUE=DATE (all-day)
//   • DURATION as an alternative to DTEND
//   • RRULE FREQ=DAILY/WEEKLY/MONTHLY/YEARLY with INTERVAL, BYDAY, COUNT, UNTIL
//   • EXDATE exclusions
// It expands recurrences only inside the caller's [windowStart, windowEnd] and
// is hard-capped so a pathological rule can never run away.

export type BusyWindow = {
  uid: string;      // stable id from the source event (for de-dupe across syncs)
  summary: string;  // event title, best-effort
  startISO: string; // UTC ISO
  endISO: string;   // UTC ISO
  allDay: boolean;
};

const MAX_OCCURRENCES = 2000;

/** Parse an .ics document into busy windows overlapping [windowStartMs, windowEndMs). */
export function parseIcsBusy(
  raw: string,
  opts: { windowStartMs: number; windowEndMs: number; defaultTz?: string },
): BusyWindow[] {
  const tz = opts.defaultTz ?? "Europe/Vilnius";
  const lines = unfold(raw);

  const out: BusyWindow[] = [];
  let inEvent = false;
  let cur: Record<string, { key: string; value: string }[]> = {};

  const flush = () => {
    if (!cur.DTSTART?.length) return;
    try {
      expandEvent(cur, tz, opts.windowStartMs, opts.windowEndMs, out);
    } catch {
      /* skip malformed event, keep the rest */
    }
  };

  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const rawKey = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const name = rawKey.split(";")[0].toUpperCase();

    if (name === "BEGIN" && value.toUpperCase() === "VEVENT") {
      inEvent = true;
      cur = {};
      continue;
    }
    if (name === "END" && value.toUpperCase() === "VEVENT") {
      if (inEvent) flush();
      inEvent = false;
      cur = {};
      continue;
    }
    if (!inEvent) continue;
    (cur[name] ??= []).push({ key: rawKey, value });
  }

  return out;
}

// ---- line unfolding (RFC 5545 §3.1) ----
function unfold(raw: string): string[] {
  const joined = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "");
  return joined.split("\n").filter((l) => l.length > 0);
}

// ---- one VEVENT → 0..N busy windows ----
function expandEvent(
  ev: Record<string, { key: string; value: string }[]>,
  defaultTz: string,
  winStart: number,
  winEnd: number,
  out: BusyWindow[],
): void {
  const status = ev.STATUS?.[0]?.value?.toUpperCase();
  if (status === "CANCELLED") return;

  const dtStartField = ev.DTSTART![0];
  const start = parseDate(dtStartField.key, dtStartField.value, defaultTz);
  if (!start) return;

  // Duration: DTEND − DTSTART, else DURATION, else default (all-day = 1 day, timed = 1h).
  let durationMs: number;
  const dtEndField = ev.DTEND?.[0];
  if (dtEndField) {
    const end = parseDate(dtEndField.key, dtEndField.value, defaultTz);
    durationMs = end ? Math.max(0, end.ms - start.ms) : fallbackDuration(start.allDay);
  } else if (ev.DURATION?.[0]) {
    durationMs = parseDuration(ev.DURATION[0].value) ?? fallbackDuration(start.allDay);
  } else {
    durationMs = fallbackDuration(start.allDay);
  }

  const uidBase = ev.UID?.[0]?.value?.trim() || `${start.ms}`;
  const summary = decodeText(ev.SUMMARY?.[0]?.value ?? "").trim();

  const exdates = new Set<number>();
  for (const ex of ev.EXDATE ?? []) {
    for (const piece of ex.value.split(",")) {
      const d = parseDate(ex.key, piece, defaultTz);
      if (d) exdates.add(d.ms);
    }
  }

  const rrule = ev.RRULE?.[0]?.value;
  const starts = rrule
    ? expandRrule(rrule, start, defaultTz, winStart, winEnd)
    : [start.ms];

  for (const s of starts) {
    if (exdates.has(s)) continue;
    const e = s + durationMs;
    if (e <= winStart || s >= winEnd) continue; // outside window
    out.push({
      uid: rrule ? `${uidBase}#${s}` : uidBase,
      summary,
      startISO: new Date(s).toISOString(),
      endISO: new Date(e).toISOString(),
      allDay: start.allDay,
    });
    if (out.length >= MAX_OCCURRENCES) return;
  }
}

function fallbackDuration(allDay: boolean): number {
  return allDay ? 86_400_000 : 3_600_000;
}

// ---- date parsing ----
type ParsedDate = { ms: number; allDay: boolean; wall: WallClock; tz: string | null };
type WallClock = { y: number; mo: number; d: number; h: number; mi: number; s: number };

function parseDate(rawKey: string, rawValue: string, defaultTz: string): ParsedDate | null {
  const value = rawValue.trim();
  const params = rawKey.split(";").slice(1);
  const isDateOnly =
    params.some((p) => /^VALUE=DATE$/i.test(p)) || /^\d{8}$/.test(value);
  const tzid = params.map((p) => /^TZID=(.+)$/i.exec(p)?.[1]).find(Boolean) ?? null;

  if (isDateOnly) {
    const m = /^(\d{4})(\d{2})(\d{2})/.exec(value);
    if (!m) return null;
    const wall: WallClock = { y: +m[1], mo: +m[2], d: +m[3], h: 0, mi: 0, s: 0 };
    return { ms: wallToUtcMs(wall, defaultTz), allDay: true, wall, tz: defaultTz };
  }

  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?/.exec(value);
  if (!m) return null;
  const wall: WallClock = { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5], s: +m[6] };
  const isUtc = m[7] === "Z";

  if (isUtc) {
    return { ms: Date.UTC(wall.y, wall.mo - 1, wall.d, wall.h, wall.mi, wall.s), allDay: false, wall, tz: "UTC" };
  }
  const zone = tzid ?? defaultTz;
  return { ms: wallToUtcMs(wall, zone), allDay: false, wall, tz: zone };
}

/** Wall-clock time in a named zone → UTC epoch ms (DST-aware within ~1 step). */
function wallToUtcMs(w: WallClock, tz: string): number {
  const guess = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s);
  const off = tzOffsetMs(new Date(guess), tz);
  // Correct once; re-check to absorb a DST boundary the first guess landed on.
  const corrected = guess - off;
  const off2 = tzOffsetMs(new Date(corrected), tz);
  return guess - off2;
}

/** ms to add to a UTC instant to get the wall-clock reading in `tz`. */
function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value;
  const asUTC = Date.UTC(
    +map.year, +map.month - 1, +map.day,
    +map.hour % 24, +map.minute, +map.second,
  );
  return asUTC - date.getTime();
}

// ---- DURATION (RFC 5545) e.g. PT1H30M, P1D, PT45M ----
function parseDuration(v: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const [, , w, d, h, mi, s] = m;
  const ms =
    (+(w ?? 0)) * 604_800_000 +
    (+(d ?? 0)) * 86_400_000 +
    (+(h ?? 0)) * 3_600_000 +
    (+(mi ?? 0)) * 60_000 +
    (+(s ?? 0)) * 1000;
  return sign * ms;
}

// ---- RRULE expansion (bounded) ----
const WEEKDAY: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function expandRrule(
  rrule: string,
  start: ParsedDate,
  tz: string,
  winStart: number,
  winEnd: number,
): number[] {
  const parts: Record<string, string> = {};
  for (const kv of rrule.split(";")) {
    const [k, val] = kv.split("=");
    if (k && val) parts[k.toUpperCase()] = val;
  }
  const freq = (parts.FREQ ?? "").toUpperCase();
  const interval = Math.max(1, parseInt(parts.INTERVAL ?? "1", 10) || 1);
  const count = parts.COUNT ? parseInt(parts.COUNT, 10) : null;
  const untilMs = parts.UNTIL ? untilToMs(parts.UNTIL, start, tz) : null;
  const byday = (parts.BYDAY ?? "")
    .split(",")
    .map((d) => WEEKDAY[d.replace(/^[+-]?\d+/, "").toUpperCase()])
    .filter((n) => n !== undefined);

  const zone = start.tz && start.tz !== "UTC" ? start.tz : tz;
  const results: number[] = [];
  const hardEnd = Math.min(winEnd, untilMs ?? winEnd) + 1;
  let emitted = 0;

  const pushIfInWindow = (ms: number): boolean => {
    if (untilMs != null && ms > untilMs) return false;
    if (ms >= winStart && ms < winEnd) results.push(ms);
    return true;
  };

  // Rebuild an occurrence at a given calendar date keeping the wall time.
  const atDate = (y: number, mo0: number, d: number): number =>
    wallToUtcMs({ y, mo: mo0 + 1, d, h: start.wall.h, mi: start.wall.mi, s: start.wall.s }, zone);

  if (freq === "WEEKLY") {
    const days = byday.length ? byday : [new Date(start.ms).getUTCDay()];
    // Walk week by week from the DTSTART week start.
    const base = new Date(start.ms);
    // Anchor to the Sunday of DTSTART's week (in UTC terms — close enough for stepping).
    const anchor = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() - base.getUTCDay());
    for (let week = 0, guard = 0; guard < 520; week += interval, guard++) {
      const weekStart = anchor + week * 604_800_000;
      if (weekStart > hardEnd) break;
      for (const wd of days.sort((a, b) => a - b)) {
        const day = new Date(weekStart + wd * 86_400_000);
        const ms = atDate(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
        if (ms < start.ms) continue;
        if (count != null && emitted >= count) return results;
        emitted++;
        if (!pushIfInWindow(ms)) return results;
        if (results.length >= MAX_OCCURRENCES) return results;
      }
    }
    return results;
  }

  if (freq === "DAILY") {
    for (let i = 0, guard = 0; guard < 5000; i += interval, guard++) {
      const day = new Date(start.ms + i * 86_400_000);
      const ms = atDate(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
      if (ms > hardEnd) break;
      if (count != null && emitted >= count) break;
      emitted++;
      if (!pushIfInWindow(ms)) break;
      if (results.length >= MAX_OCCURRENCES) break;
    }
    return results;
  }

  if (freq === "MONTHLY") {
    const base = new Date(start.ms);
    for (let i = 0, guard = 0; guard < 600; i += interval, guard++) {
      const ms = atDate(base.getUTCFullYear(), base.getUTCMonth() + i, base.getUTCDate());
      if (ms > hardEnd) break;
      if (count != null && emitted >= count) break;
      emitted++;
      if (!pushIfInWindow(ms)) break;
      if (results.length >= MAX_OCCURRENCES) break;
    }
    return results;
  }

  if (freq === "YEARLY") {
    const base = new Date(start.ms);
    for (let i = 0, guard = 0; guard < 100; i += interval, guard++) {
      const ms = atDate(base.getUTCFullYear() + i, base.getUTCMonth(), base.getUTCDate());
      if (ms > hardEnd) break;
      if (count != null && emitted >= count) break;
      emitted++;
      if (!pushIfInWindow(ms)) break;
      if (results.length >= MAX_OCCURRENCES) break;
    }
    return results;
  }

  // Unsupported FREQ — treat as single event.
  pushIfInWindow(start.ms);
  return results;
}

function untilToMs(until: string, _start: ParsedDate, tz: string): number | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/.exec(until.trim());
  if (!m) return null;
  const y = +m[1], mo = +m[2], day = +m[3];
  const h = m[4] ? +m[4] : 23, mi = m[5] ? +m[5] : 59, s = m[6] ? +m[6] : 59;
  if (m[7] === "Z") return Date.UTC(y, mo - 1, day, h, mi, s);
  return wallToUtcMs({ y, mo, d: day, h, mi, s }, tz);
}

// ---- text decode (unescape RFC 5545) ----
function decodeText(s: string): string {
  return s
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}
