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
  /** Lessons per week for the last 8 weeks, oldest→newest (index 7 = current). */
  week_buckets:          number[];
};

export type WelfareSnapshot = {
  weekLabel:    string;
  totalHorses:  number;
  byState:      Record<WelfareState, number>;
  horses:       HorseWelfareCard[];
  /** Barn-wide lessons per week for the last 8 weeks, oldest→newest. */
  barnBuckets:  number[];
  /** Short labels for each of the 8 week buckets (e.g. "12 May"). */
  weekBucketLabels: string[];
  /** Average current-week load across horses that have a cap set (0–100). */
  avgLoadPct:   number;
  /** Total saddle minutes booked this week across the barn. */
  weeklyMinutesTotal: number;
  /** The single most-loaded horse this week (for the hero highlight). */
  mostWorked:   { name: string; load_pct: number; weekly_count: number } | null;
  /** The available horse resting the longest (rest highlight). */
  longestRested:{ name: string; days: number } | null;
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
  const N_WEEKS = 8;
  const histStart = addDays(weekStart, -7 * (N_WEEKS - 1)); // start of the oldest bucket

  const supabase = createSupabaseServerClient();

  const [horsesRes, histLessonsRes, lastLessonRes] = await Promise.all([
    supabase
      .from("horses")
      .select("id, name, daily_lesson_limit, weekly_lesson_limit, active, available_for_lessons")
      .eq("active", true),
    // Last 8 weeks of lessons — drives both the current-week load and the
    // per-horse + barn trend sparklines. One query, aggregated in memory.
    supabase
      .from("lessons")
      .select("horse_id, starts_at, ends_at, status")
      .gte("starts_at", histStart.toISOString())
      .lt("starts_at",  weekEnd.toISOString())
      .neq("status",    "cancelled"),
    // last lesson ever per horse — fetch latest 500 across stable
    // and reduce in JS. Cheap; the view layer needs only the most
    // recent per horse.
    supabase
      .from("lessons")
      .select("horse_id, starts_at")
      .order("starts_at", { ascending: false })
      .limit(500),
  ]);

  if (horsesRes.error)     throw horsesRes.error;
  if (histLessonsRes.error) throw histLessonsRes.error;
  if (lastLessonRes.error) throw lastLessonRes.error;

  const horses = horsesRes.data ?? [];
  const histLessons = histLessonsRes.data ?? [];
  const allLessons = lastLessonRes.data ?? [];

  // Which of the 8 buckets does a timestamp fall into? 0 = oldest, 7 = current.
  const histStartMs = histStart.getTime();
  const bucketOf = (iso: string): number => {
    const idx = Math.floor((new Date(iso).getTime() - histStartMs) / (7 * 86_400_000));
    return idx < 0 ? -1 : Math.min(N_WEEKS - 1, idx);
  };

  // Per-horse: 8 week buckets + current-week minutes.
  const bucketsByHorse = new Map<string, number[]>();
  const weekMinutesByHorse = new Map<string, number>();
  const barnBuckets = new Array(N_WEEKS).fill(0) as number[];
  for (const l of histLessons) {
    const b = bucketOf(l.starts_at);
    if (b < 0) continue;
    const arr = bucketsByHorse.get(l.horse_id) ?? new Array(N_WEEKS).fill(0);
    arr[b] += 1;
    bucketsByHorse.set(l.horse_id, arr);
    barnBuckets[b] += 1;
    if (b === N_WEEKS - 1) {
      const mins = Math.max(0, Math.round((new Date(l.ends_at).getTime() - new Date(l.starts_at).getTime()) / 60000));
      weekMinutesByHorse.set(l.horse_id, (weekMinutesByHorse.get(l.horse_id) ?? 0) + mins);
    }
  }

  // Last lesson per horse — first occurrence wins because list is desc.
  const lastByHorse = new Map<string, string>();
  for (const l of allLessons) {
    if (!lastByHorse.has(l.horse_id)) lastByHorse.set(l.horse_id, l.starts_at);
  }

  const byState: Record<WelfareState, number> = {
    over_cap: 0, near_cap: 0, steady: 0, light: 0, resting: 0,
  };

  let loadSum = 0, loadCount = 0, weeklyMinutesTotal = 0;
  // Collect rest candidates in an array (mutating an array avoids the
  // closure control-flow-narrowing quirk that bites a `let … | null`).
  const restCandidates: { name: string; days: number }[] = [];

  const cards: HorseWelfareCard[] = horses.map((h) => {
    const buckets = bucketsByHorse.get(h.id) ?? new Array(N_WEEKS).fill(0);
    const weekCount = buckets[N_WEEKS - 1];
    const minutes = weekMinutesByHorse.get(h.id) ?? 0;
    const ratio = h.weekly_lesson_limit > 0 ? weekCount / h.weekly_lesson_limit : 0;
    const last  = lastByHorse.get(h.id) ?? null;
    const days  = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000) : null;

    let state: WelfareState;
    if (ratio >= 1)            state = "over_cap";
    else if (ratio >= 0.85)    state = "near_cap";
    else if (weekCount === 0 && (days == null || days >= 7)) state = "resting";
    else if (ratio >= 0.5)     state = "steady";
    else                       state = "light";

    byState[state] += 1;
    weeklyMinutesTotal += minutes;
    if (h.weekly_lesson_limit > 0) { loadSum += Math.min(100, ratio * 100); loadCount += 1; }

    const load_pct = Math.min(100, Math.round(ratio * 100));
    if (h.available_for_lessons && days != null) {
      restCandidates.push({ name: h.name, days });
    }

    return {
      id:                  h.id,
      name:                h.name,
      photo_url:           null,
      daily_lesson_limit:  h.daily_lesson_limit,
      weekly_lesson_limit: h.weekly_lesson_limit,
      weekly_count:        weekCount,
      weekly_minutes:      minutes,
      last_lesson_at:      last,
      days_since_last:     days,
      state,
      load_pct,
      week_buckets:        buckets,
    };
  });

  // Sort: at-risk first
  cards.sort((a, b) =>
    STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.name.localeCompare(b.name),
  );

  const weekBucketLabels = Array.from({ length: N_WEEKS }, (_, i) =>
    addDays(weekStart, -7 * (N_WEEKS - 1 - i)).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  );

  // Highlights, computed from the finished cards (no closure mutation).
  const busiest = cards.reduce<HorseWelfareCard | null>(
    (best, c) => (c.weekly_count > (best?.weekly_count ?? -1) ? c : best),
    null,
  );
  const mostWorked = busiest && busiest.weekly_count > 0
    ? { name: busiest.name, load_pct: busiest.load_pct, weekly_count: busiest.weekly_count }
    : null;
  const longestRested = restCandidates.length > 0
    ? restCandidates.reduce((a, b) => (b.days > a.days ? b : a))
    : null;

  return {
    weekLabel: `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${
      addDays(weekEnd, -1).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    }`,
    totalHorses: horses.length,
    byState,
    horses: cards,
    barnBuckets,
    weekBucketLabels,
    avgLoadPct: loadCount > 0 ? Math.round(loadSum / loadCount) : 0,
    weeklyMinutesTotal,
    mostWorked,
    longestRested,
  };
}
