// Longrein product health — the "is my SaaS alive and growing" screen.
//
// ─────────────────────────────────────────────────────────────────────
// WHY THIS FILE USES THE SERVICE-ROLE CLIENT
// ─────────────────────────────────────────────────────────────────────
// Every other dashboard service runs under her own session, so RLS
// scopes it to her stable. That is exactly wrong here: she is the
// platform operator, and "how many stables signed up this week" is a
// question about OTHER tenants' rows, which her JWT cannot and should
// not see.
//
// So this module — and only this module — uses createSupabaseAdminClient()
// to bypass RLS. The rules it follows:
//
//   1. requirePersonalContext() is awaited FIRST, every time. It throws
//      if she is not allowlisted, before any admin client is created.
//   2. Only AGGREGATES leave this file. Counts, sums, growth deltas.
//      No tenant row, no customer name, no email is ever returned —
//      so even a hypothetical gate bypass leaks statistics, not people's
//      personal data.
//   3. Nothing here writes. Every query is a count or a select of
//      non-identifying columns.
//
// If that trade ever stops feeling right, delete this file: the other
// five screens do not depend on it.

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requirePersonalContext, safe, num } from "@/services/personalDashboard/common";
import { getIntegrationConfig } from "@/services/personalDashboard/settings";

export type HealthMetric = {
  label: string;
  value: number;
  /** Change vs the previous equivalent window, when meaningful. */
  delta?: number;
  hint?: string;
};

export type LongreinHealth = {
  stables: { total: number; newLast30: number; newPrev30: number };
  users: { total: number; activeLast7: number };
  subscriptions: { active: number; trialing: number; past_due: number; cancelled: number };
  /** null when plan prices haven't been configured — see the note below. */
  mrr: number | null;
  waitlist: { total: number; last7: number; prev7: number; confirmed: number };
  /** null until an uptime/error source is connected. */
  uptime: null | { uptimePct: number; errorRate: number; window: string };
  /** Whether the operational-monitoring integration is wired at all. */
  monitoringConfigured: boolean;
};

const EMPTY: LongreinHealth = {
  stables: { total: 0, newLast30: 0, newPrev30: 0 },
  users: { total: 0, activeLast7: 0 },
  subscriptions: { active: 0, trialing: 0, past_due: 0, cancelled: 0 },
  mrr: null,
  waitlist: { total: 0, last7: 0, prev7: 0, confirmed: 0 },
  uptime: null,
  monitoringConfigured: false,
};

export async function getLongreinHealth(now = new Date()): Promise<LongreinHealth> {
  return safe(
    async () => {
      // Gate first. Nothing below runs for a non-allowlisted caller.
      await requirePersonalContext();

      const admin = createSupabaseAdminClient();
      const iso = (daysAgo: number) =>
        new Date(now.getTime() - daysAgo * 86_400_000).toISOString();

      const countOf = async (
        table: string,
        build?: (q: any) => any,
      ): Promise<number> => {
        let q = admin.from(table).select("id", { count: "exact", head: true });
        if (build) q = build(q);
        const { count } = await q;
        return count ?? 0;
      };

      const [
        stablesTotal,
        stablesNew30,
        stablesPrev30,
        usersTotal,
        waitlistTotal,
        waitlistLast7,
        waitlistPrev7,
        waitlistConfirmed,
        subsRows,
        activeActors,
      ] = await Promise.all([
        countOf("stables"),
        countOf("stables", (q) => q.gte("created_at", iso(30))),
        countOf("stables", (q) => q.gte("created_at", iso(60)).lt("created_at", iso(30))),
        countOf("profiles"),
        countOf("waitlist_signups"),
        countOf("waitlist_signups", (q) => q.gte("created_at", iso(7))),
        countOf("waitlist_signups", (q) =>
          q.gte("created_at", iso(14)).lt("created_at", iso(7)),
        ),
        countOf("waitlist_signups", (q) => q.not("confirmed_at", "is", null)),
        admin.from("subscriptions").select("plan, status"),
        // "Active users" = distinct people who caused an audited write in
        // the last 7 days. It's the closest thing to a real activity
        // signal in this schema: there is no analytics table, and
        // counting logins isn't available through the client SDK.
        admin
          .from("audit_log")
          .select("actor_profile_id")
          .gte("created_at", iso(7))
          .limit(5000),
      ]);

      const subs = subsRows.data ?? [];
      const tally = { active: 0, trialing: 0, past_due: 0, cancelled: 0 };
      for (const s of subs) {
        const k = String(s.status) as keyof typeof tally;
        if (k in tally) tally[k] += 1;
      }

      // MRR needs a plan→price map, and this codebase does not have one
      // it can trust: Stripe price IDs live in env vars, the Founding
      // Members are manually billed, and FREE_MODE is currently on. So
      // rather than inventing a number, MRR is null until she enters her
      // own plan prices in Settings. A made-up MRR on a dashboard she
      // makes decisions from is worse than a blank.
      const priceMap = await getPlanPrices();
      const mrr =
        priceMap === null
          ? null
          : subs
              .filter((s) => s.status === "active")
              .reduce((sum, s) => sum + (priceMap[String(s.plan)] ?? 0), 0);

      const distinctActors = new Set(
        (activeActors.data ?? [])
          .map((r) => r.actor_profile_id)
          .filter((v): v is string => Boolean(v)),
      );

      const monitoring = await getIntegrationConfig("monitoring");

      return {
        stables: {
          total: stablesTotal,
          newLast30: stablesNew30,
          newPrev30: stablesPrev30,
        },
        users: { total: usersTotal, activeLast7: distinctActors.size },
        subscriptions: tally,
        mrr,
        waitlist: {
          total: waitlistTotal,
          last7: waitlistLast7,
          prev7: waitlistPrev7,
          confirmed: waitlistConfirmed,
        },
        // Uptime / error rate genuinely has no source in this codebase:
        // there is no Sentry, no error table, no APM. Returning null lets
        // the UI show an honest "not connected" card with the one-line
        // instruction for wiring it, instead of a fake 99.9%.
        uptime: null,
        monitoringConfigured: Boolean(monitoring),
      };
    },
    EMPTY,
    "getLongreinHealth",
  );
}

/**
 * Monthly price per plan, in euro. Read from her own settings; null when
 * she hasn't filled them in.
 */
async function getPlanPrices(): Promise<Record<string, number> | null> {
  const cfg = await getIntegrationConfig("longrein");
  const prices = cfg?.planPrices as Record<string, unknown> | undefined;
  if (!prices || typeof prices !== "object") return null;
  const out: Record<string, number> = {};
  for (const [plan, value] of Object.entries(prices)) {
    const n = num(value);
    if (n > 0) out[plan] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}
