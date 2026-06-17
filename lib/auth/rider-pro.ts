// Rider Pro entitlement check.
//
// Who has Rider Pro:
//   - Stable owner / employee: always YES if their stable's subscription
//     is in a "good" state (active / trialing).
//   - Personal account owner: always YES (Rider Pro is bundled with the
//     Personal Mini/Plus plan — they're paying for the experience).
//   - Stable client: only if they upgraded their own client row
//     (clients.rider_pro_status in ('active', 'trialing')) AND that
//     status hasn't expired.
//
// Use anywhere we gate live tracker / share card / advanced metrics:
//
//   const pro = await hasRiderPro();
//   if (!pro.entitled) return <RiderProPaywall reason={pro.reason} />;
//
// Source of truth lives in Postgres. RLS narrows the lookup.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "./session";
import { FREE_MODE } from "@/lib/config/freeMode";

export type RiderProEntitlement = {
  entitled: boolean;
  /** Why entitled (or not). UI uses this to render the right CTA. */
  reason:
    | "owner-included"      // owner of a subscribed stable
    | "employee-included"   // trainer of a subscribed stable
    | "personal-included"   // personal account
    | "client-subscribed"   // client paying €2/mo
    | "client-trialing"     // client in 14-day trial
    | "client-needs-upgrade" // client not subscribed
    | "stable-inactive"     // owner/employee but stable subscription lapsed
    | "unauthenticated";
  /** When the entitlement runs out (trial end or period end). null for owners. */
  expires_at: string | null;
};

export async function hasRiderPro(): Promise<RiderProEntitlement> {
  let ctx;
  try {
    ctx = await getSession();
  } catch {
    return { entitled: false, reason: "unauthenticated", expires_at: null };
  }

  // FREE_MODE (early access): every signed-in user is entitled — no paywall.
  if (FREE_MODE) {
    return { entitled: true, reason: "owner-included", expires_at: null };
  }

  const supabase = createSupabaseServerClient();

  // Owner / employee — entitlement piggy-backs on stable subscription.
  if (ctx.role === "owner" || ctx.role === "employee") {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("stable_id", ctx.stableId)
      .maybeSingle();

    if (!sub) {
      // No row yet. Personal accounts always get a row; for stables this
      // can happen pre-trial. Be permissive — middleware handles billing.
      return ctx.accountType === "personal"
        ? { entitled: true, reason: "personal-included", expires_at: null }
        : { entitled: false, reason: "stable-inactive",  expires_at: null };
    }

    const goodStatus = sub.status === "active" || sub.status === "trialing";
    if (!goodStatus) {
      return { entitled: false, reason: "stable-inactive", expires_at: sub.current_period_end ?? null };
    }

    return {
      entitled:   true,
      reason:     ctx.accountType === "personal"
                    ? "personal-included"
                    : (ctx.role === "owner" ? "owner-included" : "employee-included"),
      expires_at: null,
    };
  }

  // Client — read their own row.
  if (ctx.role === "client" && ctx.clientId) {
    const { data: c } = await supabase
      .from("clients")
      .select("rider_pro_status, rider_pro_trial_end, rider_pro_period_end")
      .eq("id", ctx.clientId)
      .maybeSingle();

    if (!c) {
      return { entitled: false, reason: "client-needs-upgrade", expires_at: null };
    }

    const status = c.rider_pro_status as string | null;
    const trialEnd = c.rider_pro_trial_end as string | null;
    const periodEnd = c.rider_pro_period_end as string | null;
    const now = Date.now();

    if (status === "trialing" && trialEnd && new Date(trialEnd).getTime() > now) {
      return { entitled: true, reason: "client-trialing", expires_at: trialEnd };
    }
    if (status === "active" && periodEnd && new Date(periodEnd).getTime() > now) {
      return { entitled: true, reason: "client-subscribed", expires_at: periodEnd };
    }
    return { entitled: false, reason: "client-needs-upgrade", expires_at: null };
  }

  // Anything else (e.g. horse_owner role) → not entitled. They can be
  // upsold later if there's demand.
  return { entitled: false, reason: "client-needs-upgrade", expires_at: null };
}
