// Goals: monthly and quarterly targets, and how each one is tracking.
//
// The "actual" for a goal is not stored — it's computed from live data
// at read time by the resolver map below. That means a goal can never
// drift out of sync with reality, and adding a new trackable metric is
// one entry in RESOLVERS rather than a migration plus a backfill job.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  requirePersonalContext,
  getStableTimeZone,
  safe,
  num,
} from "@/services/personalDashboard/common";
import {
  monthBounds,
  quarterStartKey,
  monthElapsedFraction,
  weekBounds,
  weekElapsedFraction,
  goalProgress,
  forecastGoal,
  goalAdvice,
  type GoalProgress,
  type GoalForecast,
} from "@/services/personalDashboard/core.pure";

export type GoalUnit = "eur" | "count" | "percent";
export type GoalPeriod = "week" | "month" | "quarter";
export type GoalCategory = "tjk" | "longrein" | "rinkodara";

export type GoalRow = {
  id: string;
  period: GoalPeriod;
  periodStart: string;
  goalKey: string;
  label: string;
  target: number;
  unit: GoalUnit;
  category: GoalCategory | null;
  sortOrder: number;
};

export type GoalWithProgress = GoalRow & {
  progress: GoalProgress;
  /** False when nothing knows how to measure this key — see RESOLVERS. */
  measurable: boolean;
  /** Where this lands at period end at the current pace. */
  forecast: GoalForecast;
  /** One sentence saying what to do about it. */
  advice: string;
};

/**
 * The metrics a goal can be set against.
 *
 * Anything not in here can still be created as a goal — she just has to
 * read the number off another screen; it renders with a "manual" badge
 * rather than a progress bar. Better than refusing to store the goal.
 */
export const GOAL_METRICS: Array<{
  key: string;
  label: string;
  unit: GoalUnit;
  help: string;
}> = [
  {
    key: "lesson_revenue",
    label: "Pajamos iš treniruočių",
    unit: "eur",
    help: "Pristatytos treniruotės (apmokėtos + laukiančios apmokėjimo).",
  },
  {
    key: "lessons_taught",
    label: "Įvykusios treniruotės",
    unit: "count",
    help: "Treniruotės, pažymėtos kaip įvykusios.",
  },
  {
    key: "new_clients",
    label: "Nauji klientai",
    unit: "count",
    help: "Klientai, sukurti per laikotarpį.",
  },
  {
    key: "waitlist_signups",
    label: "Longrein laukiančiųjų sąrašas",
    unit: "count",
    help: "Nauji registracijos į laukiančiųjų sąrašą.",
  },
  {
    key: "new_stables",
    label: "Naujos Longrein arklidės",
    unit: "count",
    help: "Naujai užsiregistravę arklidžių paskyros.",
  },
  {
    key: "client_retention",
    label: "Klientų sugrįžtamumas",
    unit: "percent",
    help: "Kiek procentų šio laikotarpio klientų grįžo joti per 30 dienų.",
  },
  {
    key: "instagram_followers",
    label: "Instagram sekėjų prieaugis",
    unit: "count",
    help: "Skirtumas tarp naujausio ir pirmojo laikotarpio matavimo.",
  },
  {
    key: "social_posts",
    label: "Paskelbti įrašai",
    unit: "count",
    help: "Iš „Skelbimų“ ekrano — kiek įrašų iš tikrųjų išėjo.",
  },
];

/**
 * What a new dashboard starts with.
 *
 * Seeded on first visit to the Goals screen rather than in the migration:
 * a migration cannot know her numbers, and an empty goals screen teaches
 * nothing about what the screen is for. These three are deliberately
 * modest and easy to edit — the point is a working example, not a
 * prescription.
 */
const DEFAULT_GOALS: Array<{
  period: GoalPeriod;
  goalKey: string;
  label: string;
  target: number;
  unit: GoalUnit;
  category: GoalCategory;
  sortOrder: number;
}> = [
  {
    period: "month",
    goalKey: "lesson_revenue",
    label: "Pajamos iš treniruočių",
    target: 3000,
    unit: "eur",
    category: "tjk",
    sortOrder: 0,
  },
  {
    period: "week",
    goalKey: "lessons_taught",
    label: "Treniruotės per savaitę",
    target: 20,
    unit: "count",
    category: "tjk",
    sortOrder: 1,
  },
  {
    period: "week",
    goalKey: "social_posts",
    label: "Įrašai per savaitę",
    target: 3,
    unit: "count",
    category: "rinkodara",
    sortOrder: 2,
  },
];

/**
 * Make sure the current week / month / quarter have goals.
 *
 * Two jobs, in order:
 *
 *   1. A brand-new dashboard gets the three starter goals.
 *   2. Every later period INHERITS the previous one's goals.
 *
 * The second is the one that matters in daily use. Goals are stored per
 * period — "€2000 for August" is a different row from "€2000 for
 * September" — which is right for history but wrong for intent: setting
 * a monthly target means "every month", not "August only". Without the
 * carry-forward her goals would silently vanish at midnight on the 1st
 * and she would have to retype them twelve times a year.
 *
 * DELETION HAS TO STICK, THOUGH. A naive "if this period is empty, copy
 * the last one" would undo a deliberate deletion on the very next page
 * load. So each carry is recorded once, atomically, using the existing
 * dismissals table as the lock: `ignoreDuplicates` means the insert
 * returns a row only for whoever got there first. Delete a goal and it
 * stays deleted; the next period simply won't try again.
 */
export async function ensureCurrentGoals(now = new Date()): Promise<boolean> {
  return safe(
    async () => {
      const ctx = await requirePersonalContext();
      const tz = await getStableTimeZone();
      const supabase = createSupabaseServerClient();

      const { data: all } = await supabase
        .from("dashboard_goals")
        .select("period, period_start, goal_key, label, target, unit, category, sort_order")
        .eq("auth_user_id", ctx.authUserId);

      const rows = all ?? [];

      // ---- 1. First run: seed the starters ----
      if (rows.length === 0) {
        const seeded = DEFAULT_GOALS.map((g) => ({
          auth_user_id: ctx.authUserId,
          period: g.period,
          period_start: periodStartKey(g.period, now, tz),
          goal_key: g.goalKey,
          label: g.label,
          target: g.target,
          unit: g.unit,
          category: g.category,
          sort_order: g.sortOrder,
        }));
        const { error } = await supabase
          .from("dashboard_goals")
          .upsert(seeded, { onConflict: "auth_user_id,period,period_start,goal_key" });
        if (error) throw error;
        return true;
      }

      // ---- 2. Carry each period type forward ----
      let carried = false;

      for (const period of ["week", "month", "quarter"] as GoalPeriod[]) {
        const currentStart = periodStartKey(period, now, tz);
        const ofType = rows.filter((r) => String(r.period) === period);

        // Already has goals for the period we're in — nothing to do.
        if (ofType.some((r) => String(r.period_start) === currentStart)) continue;

        const past = ofType.filter((r) => String(r.period_start) < currentStart);
        if (past.length === 0) continue;

        // The most recent past period is the one to inherit from.
        const latestStart = past.reduce(
          (acc, r) => (String(r.period_start) > acc ? String(r.period_start) : acc),
          "",
        );
        const template = past.filter((r) => String(r.period_start) === latestStart);
        if (template.length === 0) continue;

        // Claim the carry. Only the first caller gets a row back, so two
        // concurrent page loads cannot duplicate the work, and a later
        // deletion is never resurrected.
        const { data: claimed } = await supabase
          .from("dashboard_dismissals")
          .upsert(
            {
              auth_user_id: ctx.authUserId,
              kind: "goal_carry",
              ref_id: `${period}:${currentStart}`,
            },
            { onConflict: "auth_user_id,kind,ref_id", ignoreDuplicates: true },
          )
          .select("id");

        if (!claimed || claimed.length === 0) continue;

        const { error } = await supabase.from("dashboard_goals").upsert(
          template.map((r) => ({
            auth_user_id: ctx.authUserId,
            period,
            period_start: currentStart,
            goal_key: String(r.goal_key),
            label: String(r.label),
            target: num(r.target),
            unit: String(r.unit),
            category: (r.category as string) ?? null,
            sort_order: num(r.sort_order),
          })),
          { onConflict: "auth_user_id,period,period_start,goal_key" },
        );
        if (error) throw error;
        carried = true;
      }

      return carried;
    },
    false,
    "ensureCurrentGoals",
  );
}

/** First day of the period `now` falls in. */
export function periodStartKey(period: GoalPeriod, now: Date, tz: string): string {
  if (period === "week") return weekBounds(now, tz).startKey;
  if (period === "quarter") return quarterStartKey(now, tz);
  return monthBounds(now, tz).startKey;
}

export async function listGoals(
  period: GoalPeriod,
  now = new Date(),
): Promise<GoalWithProgress[]> {
  return safe(
    async () => {
      const ctx = await requirePersonalContext();
      const tz = await getStableTimeZone();
      const supabase = createSupabaseServerClient();

      const periodStart = periodStartKey(period, now, tz);

      const { data } = await supabase
        .from("dashboard_goals")
        .select("id, period, period_start, goal_key, label, target, unit, category, sort_order")
        .eq("auth_user_id", ctx.authUserId)
        .eq("period", period)
        .eq("period_start", periodStart)
        .order("sort_order", { ascending: true });

      const rows: GoalRow[] = (data ?? []).map((r) => ({
        id: String(r.id),
        period: r.period as GoalPeriod,
        periodStart: String(r.period_start),
        goalKey: String(r.goal_key),
        label: String(r.label),
        target: num(r.target),
        unit: (r.unit as GoalUnit) ?? "count",
        category: (r.category as GoalCategory) ?? null,
        sortOrder: num(r.sort_order),
      }));

      if (rows.length === 0) return [];

      // Resolve every distinct metric once, even if two goals share a key.
      const keys = Array.from(new Set(rows.map((r) => r.goalKey)));
      const actuals = new Map<string, number | null>();
      await Promise.all(
        keys.map(async (key) => {
          const resolver = RESOLVERS[key];
          actuals.set(key, resolver ? await resolver(period, periodStart, now, tz) : null);
        }),
      );

      const elapsed = periodElapsedFraction(period, periodStart, now, tz);
      const { daysTotal, daysElapsed } = periodDays(period, periodStart, now, tz);

      return rows.map((r) => {
        const actual = actuals.get(r.goalKey) ?? 0;
        const forecast = forecastGoal({
          actual,
          target: r.target,
          elapsedFraction: elapsed,
          daysTotal,
          daysElapsed,
        });
        return {
          ...r,
          measurable: actuals.get(r.goalKey) !== null && actuals.get(r.goalKey) !== undefined,
          progress: goalProgress(actual, r.target, elapsed),
          forecast,
          advice: goalAdvice({
            actual,
            target: r.target,
            unit: r.unit,
            forecast,
            period: r.period,
          }),
        };
      });
    },
    [],
    `listGoals(${period})`,
  );
}

// -------------------------------------------------------------------
// Metric resolvers
// -------------------------------------------------------------------

type Resolver = (
  period: GoalPeriod,
  periodStart: string,
  now: Date,
  tz: string,
) => Promise<number | null>;

const RESOLVERS: Record<string, Resolver> = {
  lesson_revenue: async (period, periodStart) => {
    const ctx = await requirePersonalContext();
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
      .from("billable_items")
      .select("amount, paid_amount, status")
      .eq("stable_id", ctx.stableId)
      .gte("occurs_on", periodStart)
      .lt("occurs_on", periodEndKey(period, periodStart));
    // Delivered value, matching how Finansai judges the same goal.
    return (data ?? [])
      .filter((r) => r.status === "delivered" || r.status === "paid")
      .reduce((s, r) => s + num(r.amount), 0);
  },

  lessons_taught: async (period, periodStart) => {
    const ctx = await requirePersonalContext();
    const supabase = createSupabaseServerClient();
    const { count } = await supabase
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .eq("stable_id", ctx.stableId)
      .eq("status", "completed")
      .gte("starts_at", `${periodStart}T00:00:00Z`)
      .lt("starts_at", `${periodEndKey(period, periodStart)}T00:00:00Z`);
    return count ?? 0;
  },

  new_clients: async (period, periodStart) => {
    const ctx = await requirePersonalContext();
    const supabase = createSupabaseServerClient();
    const { count } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("stable_id", ctx.stableId)
      .gte("created_at", `${periodStart}T00:00:00Z`)
      .lt("created_at", `${periodEndKey(period, periodStart)}T00:00:00Z`);
    return count ?? 0;
  },

  // Platform-wide metrics need the admin client for the same reason
  // services/personalDashboard/longrein.ts does — they count other
  // tenants' rows. Same rules apply: gate first, aggregates only.
  waitlist_signups: async (period, periodStart) =>
    platformCount("waitlist_signups", periodStart, periodEndKey(period, periodStart)),

  new_stables: async (period, periodStart) =>
    platformCount("stables", periodStart, periodEndKey(period, periodStart)),

  /**
   * Share of this period's riders who came back within 30 days.
   *
   * Measured from each client's FIRST lesson in the period, and only for
   * clients whose 30-day window has actually closed. Counting someone who
   * rode yesterday as "not retained" would drag the number down every
   * single day and make it useless — the metric would mostly measure how
   * recently the period started.
   */
  client_retention: async (period, periodStart, now) => {
    const ctx = await requirePersonalContext();
    const supabase = createSupabaseServerClient();
    const endKey = periodEndKey(period, periodStart);

    const { data: inPeriod } = await supabase
      .from("lessons")
      .select("client_id, starts_at")
      .eq("stable_id", ctx.stableId)
      .eq("status", "completed")
      .not("client_id", "is", null)
      .gte("starts_at", `${periodStart}T00:00:00Z`)
      .lt("starts_at", `${endKey}T00:00:00Z`)
      .limit(2000);

    // Earliest lesson per client inside the period.
    const firstRide = new Map<string, number>();
    for (const row of inPeriod ?? []) {
      const id = String(row.client_id);
      const t = new Date(String(row.starts_at)).getTime();
      if (!firstRide.has(id) || t < (firstRide.get(id) as number)) firstRide.set(id, t);
    }

    // Only clients whose 30-day window has fully elapsed can be judged.
    const mature = [...firstRide.entries()].filter(
      ([, t]) => now.getTime() - t >= 30 * 86_400_000,
    );
    if (mature.length === 0) return null;

    const { data: later } = await supabase
      .from("lessons")
      .select("client_id, starts_at")
      .eq("stable_id", ctx.stableId)
      .in("status", ["completed", "scheduled"])
      .in("client_id", mature.map(([id]) => id))
      .limit(5000);

    let returned = 0;
    for (const [clientId, firstAt] of mature) {
      const cameBack = (later ?? []).some((l) => {
        if (String(l.client_id) !== clientId) return false;
        const t = new Date(String(l.starts_at)).getTime();
        return t > firstAt && t <= firstAt + 30 * 86_400_000;
      });
      if (cameBack) returned += 1;
    }

    return Math.round((returned / mature.length) * 100);
  },

  /**
   * Follower growth across the period.
   *
   * Meta only ever reports the CURRENT follower count, so growth needs a
   * stored baseline — dashboard_audience_snapshots, sampled daily. Null
   * until there are two samples: one data point cannot show a change,
   * and reporting "+0" would look like stagnation rather than "not
   * measured yet".
   */
  instagram_followers: async (period, periodStart) => {
    const ctx = await requirePersonalContext();
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
      .from("dashboard_audience_snapshots")
      .select("captured_on, followers")
      .eq("auth_user_id", ctx.authUserId)
      .eq("platform", "instagram")
      .gte("captured_on", periodStart)
      .lt("captured_on", periodEndKey(period, periodStart))
      .order("captured_on", { ascending: true });

    const rows = data ?? [];
    if (rows.length < 2) return null;
    return num(rows[rows.length - 1].followers) - num(rows[0].followers);
  },

  /** Posts that actually went out, from the publishing queue. */
  social_posts: async (period, periodStart) => {
    const ctx = await requirePersonalContext();
    const supabase = createSupabaseServerClient();
    const { count } = await supabase
      .from("dashboard_social_queue")
      .select("id", { count: "exact", head: true })
      .eq("auth_user_id", ctx.authUserId)
      .in("status", ["published", "partial"])
      .gte("published_at", `${periodStart}T00:00:00Z`)
      .lt("published_at", `${periodEndKey(period, periodStart)}T00:00:00Z`);
    return count ?? 0;
  },
};

async function platformCount(
  table: string,
  fromKey: string,
  toKey: string,
): Promise<number> {
  await requirePersonalContext();
  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();
  const { count } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .gte("created_at", `${fromKey}T00:00:00Z`)
    .lt("created_at", `${toKey}T00:00:00Z`);
  return count ?? 0;
}

/** Exclusive end of a period, as a YYYY-MM-DD key. */
function periodEndKey(period: GoalPeriod, periodStart: string): string {
  if (period === "week") {
    const d = new Date(`${periodStart}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  }
  const [y, m] = periodStart.split("-").map(Number);
  const step = period === "month" ? 1 : 3;
  const total = m - 1 + step;
  return `${y + Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

function periodElapsedFraction(
  period: GoalPeriod,
  periodStart: string,
  now: Date,
  tz: string,
): number {
  if (period === "week") {
    return weekElapsedFraction(weekBounds(now, tz).dayOfWeek);
  }
  if (period === "month") {
    const { dayOfMonth, daysInMonth } = monthBounds(now, tz);
    return monthElapsedFraction(dayOfMonth, daysInMonth);
  }
  const [y, m] = periodStart.split("-").map(Number);
  const start = Date.UTC(y, m - 1, 1);
  const endKey = periodEndKey(period, periodStart);
  const [ey, em] = endKey.split("-").map(Number);
  const end = Date.UTC(ey, em - 1, 1);
  const elapsed = now.getTime() - start;
  return Math.min(1, Math.max(0, elapsed / (end - start)));
}

/** Whole days in the period, and how many have gone. Drives the forecast's
 *  "€100 per day for 12 more days" arithmetic. */
function periodDays(
  period: GoalPeriod,
  periodStart: string,
  now: Date,
  tz: string,
): { daysTotal: number; daysElapsed: number } {
  if (period === "week") {
    return { daysTotal: 7, daysElapsed: weekBounds(now, tz).dayOfWeek };
  }
  if (period === "month") {
    const { dayOfMonth, daysInMonth } = monthBounds(now, tz);
    return { daysTotal: daysInMonth, daysElapsed: dayOfMonth };
  }
  const startMs = new Date(`${periodStart}T00:00:00Z`).getTime();
  const endMs = new Date(`${periodEndKey(period, periodStart)}T00:00:00Z`).getTime();
  const daysTotal = Math.round((endMs - startMs) / 86_400_000);
  const daysElapsed = Math.min(
    daysTotal,
    Math.max(0, Math.ceil((now.getTime() - startMs) / 86_400_000)),
  );
  return { daysTotal, daysElapsed };
}

// -------------------------------------------------------------------
// Archive
// -------------------------------------------------------------------

export type ArchivedGoal = GoalRow & { hit: boolean | null; actual: number | null };

/**
 * Goals from periods that have finished.
 *
 * `actual` is deliberately NOT recomputed here. The resolvers measure
 * "now" against a period, and re-running them for twelve past months
 * would be dozens of queries on a screen she opens to reminisce. Past
 * goals show the target and the label; the honest answer to "did I hit
 * it" for an old period is to open that period, which is a follow-up.
 */
export async function listArchivedGoals(limit = 30): Promise<GoalRow[]> {
  return safe<GoalRow[]>(
    async () => {
      const ctx = await requirePersonalContext();
      const tz = await getStableTimeZone();
      const supabase = createSupabaseServerClient();
      const thisMonth = monthBounds(new Date(), tz).startKey;

      const { data } = await supabase
        .from("dashboard_goals")
        .select("id, period, period_start, goal_key, label, target, unit, category, sort_order")
        .eq("auth_user_id", ctx.authUserId)
        .lt("period_start", thisMonth)
        .order("period_start", { ascending: false })
        .limit(limit);

      return (data ?? []).map((r) => ({
        id: String(r.id),
        period: r.period as GoalPeriod,
        periodStart: String(r.period_start),
        goalKey: String(r.goal_key),
        label: String(r.label),
        target: num(r.target),
        unit: (r.unit as GoalUnit) ?? "count",
        category: (r.category as GoalCategory) ?? null,
        sortOrder: num(r.sort_order),
      }));
    },
    [],
    "listArchivedGoals",
  );
}

// -------------------------------------------------------------------
// Writes
// -------------------------------------------------------------------

export async function upsertGoal(input: {
  period: GoalPeriod;
  periodStart: string;
  goalKey: string;
  label: string;
  target: number;
  unit: GoalUnit;
  category?: GoalCategory | null;
  sortOrder?: number;
}): Promise<void> {
  const ctx = await requirePersonalContext();
  const supabase = createSupabaseServerClient();

  if (!Number.isFinite(input.target) || input.target <= 0) {
    throw new Error("Tikslas turi būti didesnis už nulį.");
  }

  const { error } = await supabase.from("dashboard_goals").upsert(
    {
      auth_user_id: ctx.authUserId,
      period: input.period,
      period_start: input.periodStart,
      goal_key: input.goalKey,
      label: input.label,
      target: input.target,
      unit: input.unit,
      category: input.category ?? null,
      sort_order: input.sortOrder ?? 0,
    },
    { onConflict: "auth_user_id,period,period_start,goal_key" },
  );
  if (error) throw error;
}

export async function deleteGoal(id: string): Promise<void> {
  const ctx = await requirePersonalContext();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("dashboard_goals")
    .delete()
    .eq("id", id)
    .eq("auth_user_id", ctx.authUserId);
  if (error) throw error;
}
