// Stripe → DB subscription sync, callable from server components after
// a Checkout success_url redirect. Acts as a belt-and-braces backup for
// the Stripe webhook (/api/stripe/webhook) so the user is never blocked
// by webhook lag, retry, or misconfiguration.
//
// Called from /dashboard and /dashboard/settings/billing when they
// receive ?session_id={CHECKOUT_SESSION_ID} from Stripe's success_url.
// Same write semantics as the webhook's syncSubscription — single source
// of truth in this file means the two paths can never drift.

import "server-only";
import type Stripe from "stripe";
import { stripeServerClient, priceIdToPlan } from "@/lib/stripe/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/** Fetch a Checkout Session, extract its subscription, and write the
 *  canonical row to `subscriptions` + mirror `stables.plan`. Idempotent:
 *  re-running with the same session_id produces the same end state. */
export async function syncSubscriptionFromCheckoutSession(
  sessionId: string,
  stableId: string,
): Promise<void> {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe not configured.");
  }

  // 1. Pull the Checkout Session with the subscription expanded so we
  //    don't have to round-trip a second time.
  const checkoutSession = await stripeServerClient.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });

  // 2. Pin the customer onto the stable (idempotent — same as the
  //    checkout.session.completed webhook handler).
  const customerId = typeof checkoutSession.customer === "string"
    ? checkoutSession.customer
    : checkoutSession.customer?.id ?? null;
  if (!customerId) {
    throw new Error("Checkout session has no customer id");
  }

  const supabase = createSupabaseAdminClient();
  await supabase
    .from("stables")
    .update({ stripe_customer_id: customerId })
    .eq("id", stableId)
    .is("stripe_customer_id", null);

  // 3. Pull the subscription. checkout.sessions can have null subscription
  //    for one-time payments, but our flow is always `mode: "subscription"`.
  const sub = checkoutSession.subscription as Stripe.Subscription | null;
  if (!sub) {
    // Subscription not yet attached on Stripe's side. Webhook will catch
    // up — surface no error.
    return;
  }

  await syncSubscriptionRow(sub, stableId);
}

/** Shared upsert helper — also exported so the webhook can use the same
 *  write path if/when it is refactored. */
export async function syncSubscriptionRow(
  sub: Stripe.Subscription,
  stableId: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();

  // In Stripe 2026-04-22.dahlia, current_period_start/end moved off the
  // Subscription root onto each Item. We have one item per sub.
  const firstItem = sub.items.data[0];
  const priceId   = firstItem?.price.id ?? null;
  const plan      = priceIdToPlan(priceId);
  const status    = mapStripeStatus(sub.status);

  const periodStartIso = firstItem?.current_period_start
    ? new Date(firstItem.current_period_start * 1000).toISOString()
    : null;
  const periodEndIso = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000).toISOString()
    : null;

  await supabase
    .from("subscriptions")
    .upsert(
      {
        stable_id:              stableId,
        stripe_subscription_id: sub.id,
        stripe_price_id:        priceId,
        plan,
        status,
        current_period_start:   periodStartIso,
        current_period_end:     periodEndIso,
        cancel_at:              sub.cancel_at   ? new Date(sub.cancel_at   * 1000).toISOString() : null,
        cancelled_at:           sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
      },
      { onConflict: "stable_id" },
    );

  // Mirror plan + trial_ends_at onto the stables row for fast UI reads.
  await supabase
    .from("stables")
    .update({
      plan,
      trial_ends_at: status === "trialing" ? periodEndIso : null,
    })
    .eq("id", stableId);
}

function mapStripeStatus(s: Stripe.Subscription.Status):
  "trialing" | "active" | "past_due" | "cancelled" | "unpaid" | "paused" {
  switch (s) {
    case "trialing":           return "trialing";
    case "active":             return "active";
    case "past_due":           return "past_due";
    case "canceled":           return "cancelled";
    case "unpaid":             return "unpaid";
    case "paused":             return "paused";
    case "incomplete":
    case "incomplete_expired": return "unpaid";
    default:                   return "unpaid";
  }
}
