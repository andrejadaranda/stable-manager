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
  goalProgress,
  type GoalProgress,
} from "@/services/personalDashboard/core.pure";

export type GoalUnit = "eur" | "count" | "percent";
export type GoalPeriod = "month" | "quarter";

export type GoalRow = {
  id: string;
  period: GoalPeriod;
  periodStart: string;
  goalKey: string;
  label: string;
  target: number;
  unit: GoalUnit;
  sortOrder: number;
};

export type GoalWithProgress = GoalRow & {
  progress: GoalProgress;
  /** False when nothing knows how to measure this key — see RESOLVERS. */
  measurable: boolean;
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
];

export async function listGoals(
  period: GoalPeriod,
  now = new Date(),
): Promise<GoalWithProgress[]> {
  return safe(
    async () => {
      const ctx = await requirePersonalContext();
      const tz = await getStableTimeZone();
      const supabase = createSupabaseServerClient();

      const periodStart =
        period === "month" ? monthBounds(now, tz).startKey : quarterStartKey(now, tz);

      const { data } = await supabase
        .from("dashboard_goals")
        .select("id, period, period_start, goal_key, label, target, unit, sort_order")
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

      return rows.map((r) => {
        const actual = actuals.get(r.goalKey);
        return {
          ...r,
          measurable: actual !== null && actual !== undefined,
          progress: goalProgress(actual ?? 0, r.target, elapsed),
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
