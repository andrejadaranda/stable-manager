// Smart suggestions for the dashboard. Pure SQL aggregations, no AI.
// Each rule produces 0 or 1 suggestion; we take up to 3 across all
// rules so the widget doesn't dominate the dashboard.
//
// Rules:
//   1. Horse over weekly cap                  — welfare risk
//   2. Horse hasn't ridden in 14+ days        — flagged or planned rest
//   3. Client outstanding balance >= €100      — chase up
//   4. Active package expiring in <14 days    — top-up reminder
//   5. >5 lessons today vs typical day        — busy heads-up

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";
import { startOfWeek, addDays } from "@/lib/utils/dates";
import { listStableHealthAlerts } from "./horseHealth";

export type Suggestion = {
  id:        string;
  kind:      "welfare_risk" | "horse_resting" | "client_balance" | "package_expiring" | "busy_day" | "health_overdue" | "health_due_soon";
  title:     string;
  body:      string;
  href:      string;
  /** Severity drives the left-border color in the widget. */
  tone:      "danger" | "warning" | "info" | "ok";
};

export async function getSmartSuggestions(): Promise<Suggestion[]> {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);

  const out: Suggestion[] = [];

  // Run rules in parallel; ignore individual failures so one bad query
  // doesn't kill the whole widget.
  const [horsesRes, lessonsRes] = await Promise.all([
    supabase
      .from("horses")
      .select("id, name, weekly_lesson_limit, active")
      .eq("active", true),
    supabase
      .from("lessons")
      .select("horse_id, starts_at")
      .gte("starts_at", weekStart.toISOString())
      .lt("starts_at",  weekEnd.toISOString())
      .neq("status",    "cancelled"),
  ]);

  const horses  = horsesRes.data ?? [];
  const lessons = lessonsRes.data ?? [];

  // Rule 1: horse over weekly cap
  const weeklyCount = new Map<string, number>();
  for (const l of lessons) weeklyCount.set(l.horse_id, (weeklyCount.get(l.horse_id) ?? 0) + 1);

  const overCap = horses
    .filter((h) => h.weekly_lesson_limit > 0 && (weeklyCount.get(h.id) ?? 0) >= h.weekly_lesson_limit)
    .slice(0, 3);
  if (overCap.length > 0) {
    out.push({
      id:    "welfare_over_cap",
      kind:  "welfare_risk",
      title: overCap.length === 1
        ? `${overCap[0].name} hit the weekly cap`
        : `${overCap.length} horses over weekly cap`,
      body:  overCap.length === 1
        ? "Block new bookings or override with a reason. Welfare audit logs every override."
        : `Tap to review: ${overCap.map((h) => h.name).join(", ")}`,
      href:  "/dashboard/welfare?filter=at_risk",
      tone:  "danger",
    });
  }

  // Rule 2: long-resting horses (no lesson in 14+ days)
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const recentRes = await supabase
    .from("lessons")
    .select("horse_id, starts_at")
    .gte("starts_at", fourteenDaysAgo);
  const recentByHorse = new Set((recentRes.data ?? []).map((l) => l.horse_id));
  const longResting = horses.filter((h) => !recentByHorse.has(h.id)).slice(0, 3);
  if (longResting.length > 0) {
    out.push({
      id:    "horses_resting_long",
      kind:  "horse_resting",
      title: longResting.length === 1
        ? `${longResting[0].name} hasn't ridden in 14+ days`
        : `${longResting.length} horses idle 14+ days`,
      body:  longResting.length === 1
        ? "Healthy if planned, flag if not. Open the welfare board to triage."
        : longResting.map((h) => h.name).join(", "),
      href:  "/dashboard/welfare?filter=resting",
      tone:  "info",
    });
  }

  // Rule 3: clients with sizeable outstanding balance.
  // Skip for now — needs a per-client RPC roll-up which is heavier
  // than the dashboard widget should run on every page load. Will
  // ship as a materialized view in a later migration.

  // Rule 4: health records overdue or due in next 30 days.
  // The single biggest differentiator in stable software — we surface
  // this on the dashboard so a vaccination never falls through the
  // cracks the way it does in WhatsApp groups.
  try {
    const alerts = await listStableHealthAlerts();
    const overdue  = alerts.filter((a) => a.overdue);
    const dueSoon  = alerts.filter((a) => !a.overdue);

    const KIND_LABEL: Record<"vaccination" | "farrier" | "vet", string> = {
      vaccination: "vaccinations",
      farrier:     "farrier visits",
      vet:         "vet checks",
    };

    if (overdue.length > 0) {
      const first = overdue[0];
      out.push({
        id:    "health_overdue",
        kind:  "health_overdue",
        title: overdue.length === 1
          ? `${first.horseName} overdue: ${KIND_LABEL[first.kind]}`
          : `${overdue.length} overdue health records`,
        body:  overdue.length === 1
          ? `${first.title} was due ${Math.abs(first.daysUntil)} days ago. Open the horse's Health tab to log the visit and reset the timer.`
          : overdue.slice(0, 3).map((a) => `${a.horseName} (${KIND_LABEL[a.kind]})`).join(", "),
        href:  overdue.length === 1
          ? `/dashboard/horses/${first.horseId}?tab=health`
          : "/dashboard/horses",
        tone:  "danger",
      });
    }

    if (dueSoon.length > 0) {
      const first = dueSoon[0];
      out.push({
        id:    "health_due_soon",
        kind:  "health_due_soon",
        title: dueSoon.length === 1
          ? `${first.horseName}: ${KIND_LABEL[first.kind]} due in ${first.daysUntil}d`
          : `${dueSoon.length} health records due soon`,
        body:  dueSoon.length === 1
          ? `${first.title} on ${new Date(first.nextDue).toLocaleDateString(undefined, { month: "short", day: "numeric" })}.`
          : dueSoon.slice(0, 3).map((a) => `${a.horseName} (${KIND_LABEL[a.kind]} in ${a.daysUntil}d)`).join(", "),
        href:  dueSoon.length === 1
          ? `/dashboard/horses/${first.horseId}?tab=health`
          : "/dashboard/horses",
        tone:  "warning",
      });
    }
  } catch {
    /* If health table or RLS isn't set up, silently skip. */
  }

  return out.slice(0, 4);
}
