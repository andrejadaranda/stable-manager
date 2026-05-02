// Welfare snapshot — single screen showing every horse's workload state
// in one glance. Drives the /dashboard/welfare page. Owner + employee.
//
// State buckets match the Welfare pill on the horse profile, so what
// shows here lines up with what's on the per-horse hero:
//
//   over-cap : weekly_count >= weekly_limit             (rose)
//   near-cap : weekly_count >= 0.85 * weekly_limit      (amber)
//   steady   : weekly_count >= 0.50 * weekly_limit      (emerald)
//   light    : everything else                           (light emerald)
//   resting  : 0 lessons in last 7 days, available     (sky)
//
// Single round-trip implementation: pulls every active horse + the
// last 7 days of lessons in two parallel queries, then aggregates in
// memory. With 50 horses + ~150 lessons that's well under 100ms even
// on the free Supabase tier.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";
import { startOfWeek, addDays } from "@/lib/utils/dates";

export type WelfareState = "over_cap" | "near_cap" | "steady" | "light" | "resting";

export type HorseWelfareCard = {
  id:                    string;
  name:                  string;
  photo_url:             string | null;
  daily_lesson_limit:    number;
  weekly_lesson_limit:   number;
  /** Lesson count for current week (Mon-Sun). */
  weekly_count:          number;
  /** Total lesson minutes this week. */
  weekly_minutes:        number;
  /** Most recent lesson start (ever). null = never ridden. */
  last_lesson_at:        string | null;
  /** Days since last lesson. null = never. */
  days_since_last:       number | null;
  state:                 WelfareState;
  /** 0–100 ratio of weekly_count vs weekly_limit, capped at 100. */
  load_pct:              number;
};

export type WelfareSnapshot = {
  weekLabel:    string;
  totalHorses:  number;
  byState:      Record<WelfareState, number>;
  horses:       HorseWelfareCard[];
};

const STATE_ORDER: Record<WelfareState, number> = {
  over_cap: 0,
  near_cap: 1,
  resting:  2,
  steady:   3,
  light:    4,
};

export async function getWelfareSnapshot(): Promise<WelfareSnapshot> {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);

  const supabase = createSupabaseServerClient();

  const [horsesRes, weekLessonsRes, lastLessonRes] = await Promise.all([
    supabase
      .from("horses")
      .select("id, name, daily_lesson_limit, weekly_lesson_limit, active, available_for_lessons")
      .eq("active", true),
    supabase
      .from("lessons")
      .select("horse_id, starts_at, ends_at, status")
      .gte("starts_at", weekStart.toISOString())
      .lt("starts_at",  weekEnd.toISOString())
      .neq("status",    "cancelled"),
    // last lesson ever per horse — fetch latest 200 across stable
    // and reduce in JS. Cheap; the view layer needs only the most
    // recent per horse.
    supabase
      .from("lessons")
      .select("horse_id, starts_at")
      .order("starts_at", { ascending: false })
      .limit(500),
  ]);

  if (horsesRes.error)      throw horsesRes.error;
  if (weekLessonsRes.error) throw weekLessonsRes.error;
  if (lastLessonRes.error)  throw lastLessonRes.error;

  const horses = horsesRes.data ?? [];
  const weekLessons = weekLessonsRes.data ?? [];
  const allLessons = lastLessonRes.data ?? [];

  // Aggregate weekly per horse
  const weeklyByHorse = new Map<string, { count: number; minutes: number }>();
  for (const l of weekLessons) {
    const cur = weeklyByHorse.get(l.horse_id) ?? { count: 0, minutes: 0 };
    cur.count += 1;
    const start = new Date(l.starts_at).getTime();
    const end   = new Date(l.ends_at).getTime();
    cur.minutes += Math.max(0, Math.round((end - start) / 60000));
    weeklyByHorse.set(l.horse_id, cur);
  }

  // Last lesson per horse — first occurrence wins because list is desc.
  const lastByHorse = new Map<string, string>();
  for (const l of allLessons) {
    if (!lastByHorse.has(l.horse_id)) lastByHorse.set(l.horse_id, l.starts_at);
  }

  // Build cards + bucket
  const byState: Record<WelfareState, number> = {
    over_cap: 0, near_cap: 0, steady: 0, light: 0, resting: 0,
  };

  const cards: HorseWelfareCard[] = horses.map((h) => {
    const w = weeklyByHorse.get(h.id) ?? { count: 0, minutes: 0 };
    const ratio = h.weekly_lesson_limit > 0
      ? w.count / h.weekly_lesson_limit
      : 0;
    const last  = lastByHorse.get(h.id) ?? null;
    const days  = last
      ? Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000)
      : null;

    let state: WelfareState;
    if (ratio >= 1)            state = "over_cap";
    else if (ratio >= 0.85)    state = "near_cap";
    else if (w.count === 0 && (days == null || days >= 7)) state = "resting";
    else if (ratio >= 0.5)     state = "steady";
    else                       state = "light";

    byState[state] += 1;

    return {
      id:                  h.id,
      name:                h.name,
      photo_url:           null,
      daily_lesson_limit:  h.daily_lesson_limit,
      weekly_lesson_limit: h.weekly_lesson_limit,
      weekly_count:        w.count,
      weekly_minutes:      w.minutes,
      last_lesson_at:      last,
      days_since_last:     days,
      state,
      load_pct:            Math.min(100, Math.round(ratio * 100)),
    };
  });

  // Sort: at-risk first
  cards.sort((a, b) =>
    STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.name.localeCompare(b.name),
  );

  return {
    weekLabel: `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${
      addDays(weekEnd, -1).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    }`,
    totalHorses: horses.length,
    byState,
    horses: cards,
  };
}
