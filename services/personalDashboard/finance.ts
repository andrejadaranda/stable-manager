// Money: what came in, what's owed, what's booked, and where that
// lands versus the monthly goal.
//
// Everything reads from `billable_items` (migration 105) rather than
// re-deriving revenue from lessons + payments here. That view is already
// the app's single answer to "what does this client owe" — it handles
// group-lesson splits, package-covered lessons (price 0, excluded),
// boarding and misc charges. A second, subtly different revenue
// calculation living in the dashboard would eventually disagree with the
// Finance page, and then neither number could be trusted.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  requirePersonalContext,
  getStableTimeZone,
  safe,
  num,
} from "@/services/personalDashboard/common";
import {
  monthBounds,
  monthElapsedFraction,
  goalProgress,
  forecastMonth,
  localDateKey,
  type GoalProgress,
  type RevenueForecast,
} from "@/services/personalDashboard/core.pure";

export type RevenueByClient = {
  clientId: string;
  clientName: string;
  amount: number;
  lessons: number;
};

export type UnpaidItem = {
  sourceId: string;
  itemType: string;
  title: string;
  clientId: string;
  clientName: string;
  amount: number;
  paidAmount: number;
  outstanding: number;
  occursOn: string;
  daysOverdue: number;
};

export type FinanceSnapshot = {
  monthKey: string;
  forecast: RevenueForecast;
  /** null when she hasn't set a revenue goal for this month yet. */
  goal: (GoalProgress & { label: string }) | null;
  lessonsDelivered: number;
  topClients: RevenueByClient[];
  unpaid: UnpaidItem[];
  totalOutstanding: number;
};

/** The `lesson_revenue` goal key is the one Finansai reads. */
export const REVENUE_GOAL_KEY = "lesson_revenue";

export async function getFinanceSnapshot(now = new Date()): Promise<FinanceSnapshot> {
  const tz = await getStableTimeZone();
  const { startKey, daysInMonth, dayOfMonth } = monthBounds(now, tz);

  const empty: FinanceSnapshot = {
    monthKey: startKey,
    forecast: forecastMonth({
      earnedToDate: 0,
      outstanding: 0,
      booked: 0,
      dayOfMonth,
      daysInMonth,
    }),
    goal: null,
    lessonsDelivered: 0,
    topClients: [],
    unpaid: [],
    totalOutstanding: 0,
  };

  return safe(
    async () => {
      const ctx = await requirePersonalContext();
      const supabase = createSupabaseServerClient();

      // Month window as plain dates — billable_items.occurs_on is a DATE
      // column, so no timezone conversion is involved on this comparison.
      const monthStart = startKey;
      const nextMonth = nextMonthKey(startKey);
      const todayKey = localDateKey(now, tz);

      const [monthRows, unpaidRows, goalRow] = await Promise.all([
        supabase
          .from("billable_items")
          .select("item_type, source_id, client_id, amount, paid_amount, occurs_on, status")
          .eq("stable_id", ctx.stableId)
          .gte("occurs_on", monthStart)
          .lt("occurs_on", nextMonth),
        supabase
          .from("billable_items")
          .select("item_type, source_id, client_id, title, amount, paid_amount, occurs_on, status")
          .eq("stable_id", ctx.stableId)
          .eq("status", "delivered")
          .order("occurs_on", { ascending: true })
          .limit(50),
        supabase
          .from("dashboard_goals")
          .select("label, target")
          .eq("auth_user_id", ctx.authUserId)
          .eq("period", "month")
          .eq("period_start", monthStart)
          .eq("goal_key", REVENUE_GOAL_KEY)
          .maybeSingle(),
      ]);

      const rows = monthRows.data ?? [];

      // Collected: what has actually been paid against this month's items.
      const earnedToDate = rows.reduce((s, r) => s + num(r.paid_amount), 0);

      // Delivered but not (fully) paid — real money, just not in hand.
      const outstanding = rows
        .filter((r) => r.status === "delivered")
        .reduce((s, r) => s + (num(r.amount) - num(r.paid_amount)), 0);

      // Still to happen this month: lessons already in the calendar.
      const booked = rows
        .filter((r) => r.status === "scheduled" && String(r.occurs_on) >= todayKey)
        .reduce((s, r) => s + num(r.amount), 0);

      const lessonsDelivered = rows.filter(
        (r) => r.item_type === "lesson" && (r.status === "delivered" || r.status === "paid"),
      ).length;

      const forecast = forecastMonth({
        earnedToDate,
        outstanding,
        booked,
        dayOfMonth,
        daysInMonth,
      });

      // Goal is judged against delivered value (earned + owed), not cash
      // collected. Someone paying late is a collections problem, not a
      // reason to say she missed her earnings goal.
      const goal = goalRow.data
        ? {
            ...goalProgress(
              earnedToDate + outstanding,
              num(goalRow.data.target),
              monthElapsedFraction(dayOfMonth, daysInMonth),
            ),
            label: String(goalRow.data.label),
          }
        : null;

      // Client names for both the top list and the unpaid list, in one
      // round trip rather than one per row.
      const clientIds = Array.from(
        new Set(
          [...rows, ...(unpaidRows.data ?? [])]
            .map((r) => r.client_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const names = await loadClientNames(supabase, clientIds);

      const byClient = new Map<string, RevenueByClient>();
      for (const r of rows) {
        if (!r.client_id) continue;
        if (r.status === "cancelled") continue;
        const id = String(r.client_id);
        const entry = byClient.get(id) ?? {
          clientId: id,
          clientName: names.get(id) ?? "—",
          amount: 0,
          lessons: 0,
        };
        entry.amount += num(r.amount);
        if (r.item_type === "lesson") entry.lessons += 1;
        byClient.set(id, entry);
      }

      const unpaid: UnpaidItem[] = (unpaidRows.data ?? []).map((r) => {
        const id = String(r.client_id ?? "");
        const amount = num(r.amount);
        const paid = num(r.paid_amount);
        return {
          sourceId: String(r.source_id),
          itemType: String(r.item_type),
          title: String(r.title ?? ""),
          clientId: id,
          clientName: names.get(id) ?? "—",
          amount,
          paidAmount: paid,
          outstanding: amount - paid,
          occursOn: String(r.occurs_on),
          daysOverdue: daysBetweenKeys(String(r.occurs_on), todayKey),
        };
      });

      return {
        monthKey: startKey,
        forecast,
        goal,
        lessonsDelivered,
        topClients: [...byClient.values()]
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5),
        unpaid,
        totalOutstanding: unpaid.reduce((s, u) => s + u.outstanding, 0),
      };
    },
    empty,
    "getFinanceSnapshot",
  );
}

async function loadClientNames(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  ids: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const { data } = await supabase.from("clients").select("id, full_name").in("id", ids);
  for (const c of data ?? []) out.set(String(c.id), String(c.full_name ?? "—"));
  return out;
}

/** "2026-08-01" -> "2026-09-01". Plain string math; no timezone involved. */
function nextMonthKey(monthStart: string): string {
  const [y, m] = monthStart.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}

/** Whole days between two YYYY-MM-DD keys. Both are already local dates. */
function daysBetweenKeys(from: string, to: string): number {
  const [ay, am, ad] = from.split("-").map(Number);
  const [by, bm, bd] = to.split("-").map(Number);
  return Math.round(
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000,
  );
}
