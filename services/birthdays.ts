// Upcoming birthdays — horses + clients (when DOB known). Surfaces as
// a small dashboard widget. The point isn't HR; it's emotional
// connection — riders love when their trainer remembers Bella turning 12.
//
// Window: today + next 14 days. Year-agnostic — we compare month/day
// only and ignore the year stored in date_of_birth.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";

export type BirthdayEntry = {
  id:        string;
  kind:      "horse" | "client";
  name:      string;
  /** Local YYYY-MM-DD of the upcoming birthday (this year). */
  date:      string;
  /** Age they will turn (or null if DOB year unknown). */
  age:       number | null;
  /** Days from today (0 = today). */
  daysAway:  number;
  href:      string;
};

const WINDOW_DAYS = 14;

export async function getUpcomingBirthdays(): Promise<BirthdayEntry[]> {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();
  const horsesRes = await supabase
    .from("horses")
    .select("id, name, date_of_birth, active")
    .eq("active", true)
    .not("date_of_birth", "is", null);

  const out: BirthdayEntry[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const h of (horsesRes.data ?? []) as Array<{ id: string; name: string; date_of_birth: string }>) {
    const e = computeBirthday(h.date_of_birth, today);
    if (!e) continue;
    out.push({
      id:       h.id,
      kind:     "horse",
      name:     h.name,
      date:     e.dateLocal,
      age:      e.age,
      daysAway: e.daysAway,
      href:     `/dashboard/horses/${h.id}`,
    });
  }

  // Client birthdays will come once clients.date_of_birth is added in
  // a future migration; service shape is already future-proof.

  out.sort((a, b) => a.daysAway - b.daysAway);
  return out;
}

function computeBirthday(
  dob: string,
  today: Date,
): { dateLocal: string; age: number | null; daysAway: number } | null {
  // dob in "YYYY-MM-DD" form. Treat as local; we ignore year for the
  // upcoming-date comparison but use it for age calculation.
  const [y, m, d] = dob.split("-").map(Number);
  if (!m || !d) return null;
  const thisYear = today.getFullYear();
  const candidate = new Date(thisYear, m - 1, d);
  candidate.setHours(0, 0, 0, 0);
  // If this year's already passed, look at next year's instance.
  if (candidate.getTime() < today.getTime()) {
    candidate.setFullYear(thisYear + 1);
  }
  const daysAway = Math.round(
    (candidate.getTime() - today.getTime()) / 86_400_000,
  );
  if (daysAway > WINDOW_DAYS) return null;

  const age = y && y > 0 ? candidate.getFullYear() - y : null;

  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    dateLocal: `${candidate.getFullYear()}-${pad(candidate.getMonth() + 1)}-${pad(candidate.getDate())}`,
    age,
    daysAway,
  };
}
