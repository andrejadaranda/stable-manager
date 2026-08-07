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
import { getStripeMrr } from "@/services/personalDashboard/mrr";
import {
  computeUptime,
  countErrorsSince,
  type UptimeWindow,
} from "@/services/personalDashboard/ops.pure";
import {
  classifyStable,
  summarise,
  customersCreatedBetween,
  type TenantBreakdown,
} from "@/services/personalDashboard/tenants";

export type HealthMetric = {
  label: string;
  value: number;
  /** Change vs the previous equivalent window, when meaningful. */
  delta?: number;
  hint?: string;
};

export type FoundingMembers = {
  total: number;
  committed: number;
  active: number;
  churned: number;
  /** Contracted monthly value once the free year ends, in euro. */
  monthlyEur: number;
  /** False when the roster table hasn't been created yet. */
  tableExists: boolean;
};

export type LongreinHealth = {
  /**
   * Counts REAL external customers, not rows in the stables table.
   * `breakdown` carries the rest so the card can show its working —
   * see services/personalDashboard/tenants.ts for why.
   */
  stables: {
    total: number;
    newLast30: number;
    newPrev30: number;
    breakdown: TenantBreakdown;
  };
  users: { total: number; activeLast7: number };
  subscriptions: { active: number; trialing: number; past_due: number; cancelled: number };
  /** null when neither Stripe nor manual plan prices can produce a number. */
  mrr: number | null;
  /** Where the MRR figure came from — the UI labels the estimate as one. */
  mrrSource: "stripe" | "manual" | null;
  waitlist: { total: number; last7: number; prev7: number; confirmed: number };
  /** null until the uptime probe has recorded at least one check. */
  uptime: null | UptimeWindow;
  uptime7d: null | UptimeWindow;
  errors24h: number;
  errors7d: number;
  foundingMembers: FoundingMembers;
  /** Whether a third-party monitoring vendor is wired in as well. */
  monitoringConfigured: boolean;
};

const NO_FOUNDING_MEMBERS: FoundingMembers = {
  total: 0,
  committed: 0,
  active: 0,
  churned: 0,
  monthlyEur: 0,
  tableExists: false,
};

const EMPTY: LongreinHealth = {
  stables: {
    total: 0,
    newLast30: 0,
    newPrev30: 0,
    breakdown: { customers: 0, own: 0, internal: 0, total: 0 },
  },
  users: { total: 0, activeLast7: 0 },
  subscriptions: { active: 0, trialing: 0, past_due: 0, cancelled: 0 },
  mrr: null,
  mrrSource: null,
  waitlist: { total: 0, last7: 0, prev7: 0, confirmed: 0 },
  uptime: null,
  uptime7d: null,
  errors24h: 0,
  errors7d: 0,
  foundingMembers: NO_FOUNDING_MEMBERS,
  monitoringConfigured: false,
};

/** Must match the schedule in .github/workflows/health-check.yml. If the
 *  cron cadence changes, change this too — uptime is measured against it. */
const PROBE_INTERVAL_MINUTES = 5;

export async function getLongreinHealth(now = new Date()): Promise<LongreinHealth> {
  return safe(
    async () => {
      // Gate first. Nothing below runs for a non-allowlisted caller.
      const ctx = await requirePersonalContext();

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
        stableRows,
        ownerRows,
        usersTotal,
        waitlistTotal,
        waitlistLast7,
        waitlistPrev7,
        waitlistConfirmed,
        subsRows,
        activeActors,
        healthRows,
        errorRows,
        foundingRows,
        stripeMrr,
      ] = await Promise.all([
        // Rows, not counts: every stable has to be classified before it
        // can be counted, because most of them are not customers.
        admin.from("stables").select("id, name, created_at"),
        // Owner email is what distinguishes a customer from a test
        // account. `role = owner` is one row per stable.
        admin.from("profiles").select("stable_id, auth_user_id").eq("role", "owner"),
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
        // 7 days of 5-minute probes is 2016 rows; the ceiling leaves room
        // for cron drift without ever paging.
        admin
          .from("dashboard_health_checks")
          .select("checked_at, ok, latency_ms")
          .gte("checked_at", iso(7))
          .order("checked_at", { ascending: false })
          .limit(2500),
        admin
          .from("dashboard_errors")
          .select("occurred_at")
          .gte("occurred_at", iso(7))
          .order("occurred_at", { ascending: false })
          .limit(2000),
        admin.from("founding_members").select("status, monthly_eur"),
        getStripeMrr(),
      ]);

      const subs = subsRows.data ?? [];
      const tally = { active: 0, trialing: 0, past_due: 0, cancelled: 0 };
      for (const s of subs) {
        const k = String(s.status) as keyof typeof tally;
        if (k in tally) tally[k] += 1;
      }

      // MRR, best source first. Stripe knows the real prices; the manual
      // plan-price map she can type in is the fallback for the current
      // pre-Stripe state (Founding Members are hand-billed and FREE_MODE
      // is on, so Stripe may legitimately report zero active subs).
      let mrr: number | null = null;
      let mrrSource: "stripe" | "manual" | null = null;

      if (stripeMrr.source === "stripe" && stripeMrr.counted > 0) {
        mrr = stripeMrr.mrr;
        mrrSource = "stripe";
      } else {
        const priceMap = await getPlanPrices();
        if (priceMap !== null) {
          mrr = subs
            .filter((s) => s.status === "active")
            .reduce((sum, s) => sum + (priceMap[String(s.plan)] ?? 0), 0);
          mrrSource = "manual";
        } else if (stripeMrr.source === "stripe") {
          // Stripe answered, and the answer was "nobody is paying yet".
          // Zero is a real number here, not a missing one.
          mrr = stripeMrr.mrr;
          mrrSource = "stripe";
        }
      }

      const distinctActors = new Set(
        (activeActors.data ?? [])
          .map((r) => r.actor_profile_id)
          .filter((v): v is string => Boolean(v)),
      );

      const monitoring = await getIntegrationConfig("monitoring");

      // ---- Who is actually a customer ----
      // Owner emails live in auth.users, which PostgREST cannot join to,
      // so they are fetched by id with the admin auth API.
      const ownerByStable = new Map<string, string>();
      for (const row of ownerRows.data ?? []) {
        if (row.stable_id && row.auth_user_id) {
          ownerByStable.set(String(row.stable_id), String(row.auth_user_id));
        }
      }

      const emailByUserId = new Map<string, string>();
      await Promise.all(
        [...new Set(ownerByStable.values())].map(async (userId) => {
          const { data } = await admin.auth.admin.getUserById(userId);
          if (data?.user?.email) emailByUserId.set(userId, data.user.email);
        }),
      );

      const longreinCfg = await getIntegrationConfig("longrein");
      const excludedIds = Array.isArray(longreinCfg?.excludedStableIds)
        ? (longreinCfg.excludedStableIds as string[])
        : [];

      const classified = (stableRows.data ?? []).map((s) => {
        const ownerId = ownerByStable.get(String(s.id));
        return classifyStable({
          id: String(s.id),
          name: String(s.name ?? "—"),
          createdAt: String(s.created_at),
          ownerEmail: ownerId ? (emailByUserId.get(ownerId) ?? null) : null,
          operatorEmail: ctx.email,
          ownStableId: ctx.stableId,
          excludedIds,
        });
      });

      const breakdown = summarise(classified);

      // ---- Uptime and errors ----
      const checks = (healthRows.data ?? []).map((r) => ({
        checkedAt: String(r.checked_at),
        ok: Boolean(r.ok),
        latencyMs: r.latency_ms === null ? null : num(r.latency_ms),
      }));
      const errors = (errorRows.data ?? []).map((r) => ({
        occurredAt: String(r.occurred_at),
      }));

      const uptimeOpts = { now, intervalMinutes: PROBE_INTERVAL_MINUTES };

      // ---- Founding members ----
      // `foundingRows.error` rather than an empty array is how "table not
      // created yet" is distinguished from "roster is empty". The two
      // want different words on screen.
      const founding: FoundingMembers = foundingRows.error
        ? NO_FOUNDING_MEMBERS
        : (foundingRows.data ?? []).reduce<FoundingMembers>(
            (acc, row) => {
              const status = String(row.status);
              acc.total += 1;
              if (status === "committed") acc.committed += 1;
              else if (status === "active") acc.active += 1;
              else if (status === "churned") acc.churned += 1;
              // Churned members are still on the roster for history, but
              // they are not future revenue.
              if (status !== "churned") acc.monthlyEur += num(row.monthly_eur);
              return acc;
            },
            { ...NO_FOUNDING_MEMBERS, tableExists: true },
          );

      return {
        stables: {
          total: breakdown.customers,
          newLast30: customersCreatedBetween(classified, iso(30), iso(0)),
          newPrev30: customersCreatedBetween(classified, iso(60), iso(30)),
          breakdown,
        },
        users: { total: usersTotal, activeLast7: distinctActors.size },
        subscriptions: tally,
        mrr,
        mrrSource,
        waitlist: {
          total: waitlistTotal,
          last7: waitlistLast7,
          prev7: waitlistPrev7,
          confirmed: waitlistConfirmed,
        },
        // Both windows come from the same probe series. 24h is the "is it
        // broken right now" number; 7d is the one worth trusting, because
        // a single missed cron run moves the 24h figure by 0.35% and the
        // 7d figure by 0.05%.
        uptime: computeUptime(checks, { ...uptimeOpts, windowHours: 24 }),
        uptime7d: computeUptime(checks, { ...uptimeOpts, windowHours: 24 * 7 }),
        errors24h: countErrorsSince(errors, { now, hours: 24 }),
        errors7d: countErrorsSince(errors, { now, hours: 24 * 7 }),
        foundingMembers: founding,
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
