// Smart Intake — parse ONE free-text Lithuanian message (typed while on the
// phone with a client) into a lesson DRAFT. It never commits anything: the
// caller prefills the create-lesson form and the human confirms.
//
// Handles the shapes that actually get typed:
//   dates  — "gruodžio 12", "rytoj", "šiandien", "poryt", "12-15", "2025-12-12",
//            weekday names ("penktadienį")
//   time   — "15:00", "15.30", "15 val", "15h", "3 po pietų"
//   phone  — "+37061234567", "8 612 34567", "861234567"
//   name   — leading capitalised words before the details
// Everything else stays in `notes` (e.g. "8 metų, be patirties") so no context
// is lost — the owner edits the draft anyway.
//
// NB: Lithuanian diacritics break JS `\b` word boundaries and the ASCII
// upper/lower ranges, so this tokenises on whitespace and compares tokens
// directly instead of relying on \b.

export type IntakeDraft = {
  name: string | null;
  phone: string | null;   // normalised +3706xxxxxxx when possible
  date: string | null;    // YYYY-MM-DD
  time: string | null;    // HH:MM (24h)
  notes: string;          // the original message, trimmed
};

const LT_MONTHS: Record<string, number> = {
  sausio: 1, vasario: 2, kovo: 3, balandžio: 4, gegužės: 5, birželio: 6,
  liepos: 7, rugpjūčio: 8, rugsėjo: 9, spalio: 10, lapkričio: 11, gruodžio: 12,
};

// Weekday name (accusative, as spoken: "penktadienį") → 1=Mon … 7=Sun.
const LT_WEEKDAYS: Record<string, number> = {
  pirmadienį: 1, antradienį: 2, trečiadienį: 3, ketvirtadienį: 4,
  penktadienį: 5, šeštadienį: 6, sekmadienį: 7,
};

// Uppercase-letter test that includes the Lithuanian uppercase letters but NOT
// their lowercase forms (the `À-Ž` unicode range wrongly includes lowercase).
const STARTS_UPPER = /^[A-ZĄČĘĖĮŠŲŪŽ]/;

function pad(n: number): string { return String(n).padStart(2, "0"); }
function iso(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function addDays(d: Date, n: number): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }

export function parseIntake(text: string, now: Date = new Date()): IntakeDraft {
  const notes = text.trim();
  const tokens = notes.split(/\s+/);
  const lowerTokens = tokens.map((t) => t.toLowerCase());

  return {
    name:  parseName(tokens),
    phone: parsePhone(notes),
    time:  parseTime(notes),
    date:  parseDate(lowerTokens, notes.toLowerCase(), now),
    notes,
  };
}

// ---- phone ----
function parsePhone(text: string): string | null {
  const m = text.match(/(?:\+370|8|0)?[\s-]?(6\d{2})[\s-]?(\d{2})[\s-]?(\d{3})/);
  if (!m) return null;
  return `+370${m[1]}${m[2]}${m[3]}`;
}

// ---- time ----
function parseTime(text: string): string | null {
  const lower = text.toLowerCase();
  // "15:00" / "15.30" — explicit separator only (avoids catching "12 15" from a date)
  let m = lower.match(/\b(\d{1,2})[:.](\d{2})\b/);
  if (m) {
    const h = Number(m[1]); const min = Number(m[2]);
    if (h < 24 && min < 60) return `${pad(h)}:${pad(min)}`;
  }
  // "15 val" / "15val" / "15h"
  m = lower.match(/\b(\d{1,2})\s?(?:val|h)\b/);
  if (m && Number(m[1]) < 24) return `${pad(Number(m[1]))}:00`;
  // "3 po pietų" → 15:00
  m = lower.match(/\b(\d{1,2})\s?po\s?piet/);
  if (m) { const h = Number(m[1]); if (h >= 1 && h <= 11) return `${pad(h + 12)}:00`; }
  return null;
}

// ---- date ----
function parseDate(lowerTokens: string[], lower: string, now: Date): string | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const has = (w: string) => lowerTokens.includes(w);

  if (has("šiandien")) return iso(today);
  if (has("rytoj"))    return iso(addDays(today, 1));
  if (has("poryt"))    return iso(addDays(today, 2));

  // Month name followed by a day number, e.g. "gruodžio 12".
  for (let i = 0; i < lowerTokens.length - 1; i++) {
    const mon = LT_MONTHS[lowerTokens[i]];
    if (mon) {
      const day = Number(lowerTokens[i + 1].replace(/\D/g, ""));
      if (day >= 1 && day <= 31) return futureDate(now, mon, day);
    }
  }

  // ISO date anywhere.
  let m = lower.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;

  // dd-mm / mm-dd style (both ≤ 12 → assume month-day).
  m = lower.match(/\b(\d{1,2})[-./](\d{1,2})\b/);
  if (m) {
    const a = Number(m[1]); const b = Number(m[2]);
    let mon: number, day: number;
    if (a > 12) { day = a; mon = b; }
    else if (b > 12) { mon = a; day = b; }
    else { mon = a; day = b; }
    if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) return futureDate(now, mon, day);
  }

  // Weekday name → next occurrence.
  for (const t of lowerTokens) {
    const wd = LT_WEEKDAYS[t];
    if (wd) return iso(nextWeekday(today, wd));
  }

  return null;
}

/** month + day → next occurrence as YYYY-MM-DD (this year, else next year). */
function futureDate(now: Date, month: number, day: number): string {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let candidate = new Date(now.getFullYear(), month - 1, day);
  if (candidate < today) candidate = new Date(now.getFullYear() + 1, month - 1, day);
  return iso(candidate);
}

/** Next date after `from` whose ISO weekday (1=Mon…7=Sun) matches. */
function nextWeekday(from: Date, wd: number): Date {
  const cur = ((from.getDay() + 6) % 7) + 1; // JS 0=Sun → 1=Mon…7=Sun
  let delta = (wd - cur + 7) % 7;
  if (delta === 0) delta = 7; // the upcoming one, not today
  return addDays(from, delta);
}

// ---- name ----
// Leading run of Capitalised words before any digit / detail keyword.
function parseName(tokens: string[]): string | null {
  const stopWord = /^(tel|met[ųai]|be|nuo|iki|val|po|\+?\d)/i;
  const words: string[] = [];
  for (const raw of tokens) {
    const low = raw.toLowerCase();
    if (LT_MONTHS[low] || LT_WEEKDAYS[low] || low === "šiandien" || low === "rytoj" || low === "poryt") break;
    if (stopWord.test(raw) || /\d/.test(raw)) break;
    if (STARTS_UPPER.test(raw)) {
      words.push(raw);
      if (words.length >= 3) break;
    } else if (words.length > 0) {
      break;
    } else {
      // haven't started a name yet and this isn't capitalised — skip it
      continue;
    }
  }
  return words.length ? words.join(" ") : null;
}
