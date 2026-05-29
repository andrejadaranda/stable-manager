// POST /api/stripe/webhook
//
// Stripe → Longrein sync. The Stripe webhook is the ONLY writer of
// authoritative billing state in the database; everything else (the
// dashboard, the billing settings page, the gating helper) reads.
//
// Wiring (do once, before M6 public launch):
//   1. In Stripe Dashboard → Developers → Webhooks, add an endpoint
//      pointing at https://app.longrein.eu/api/stripe/webhook
//   2. Select the events listed in EVENTS_HANDLED below.
//   3. Copy the webhook signing secret into env as STRIPE_WEBHOOK_SECRET.
//   4. Create one Product per tier (Starter / Pro / Premium) in Stripe,
//      copy the price ids into env as STRIPE_PRICE_STARTER / _PRO /
//      _PREMIUM. priceIdToPlan() in lib/stripe/server.ts maps them.
//
// Until those env vars are set, this route returns 503. It will not
// silently accept events and lose them.
//
// Schema contract (post migration 36):
//   - subscriptions.* is the canonical billing record.
//   - stables.plan is a fast-read mirror of subscriptions.plan.
//   - stables.trial_ends_at mirrors subscriptions.current_period_end
//     while status is 'trialing'.
//   - stables.stripe_customer_id is set on first checkout, never edited.
//
// Run as service_role (bypasses RLS). Never call from client code.

import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripeServerClient, priceIdToPlan } from "@/lib/stripe/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";          // Stripe SDK uses Node crypto.
export const dynamic = "force-dynamic";

const EVENTS_HANDLED = new Set<Stripe.Event["type"]>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.trial_will_end", // 3 days before trial ends — Day 11 reminder hook
  "invoice.payment_succeeded",            // first charge / renewal — billing confirmation hook
  "invoice.payment_failed",
]);

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) {
    // Fail loudly. Returning 200 here would make Stripe think the
    // event was delivered — losing real billing state forever.
    return NextResponse.json(
      { ok: false, error: "Stripe webhook not configured." },
      { status: 503 },
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { ok: false, error: "Missing stripe-signature header." },
      { status: 400 },
    );
  }

  // Stripe needs the raw body to verify the signature. NextRequest
  // gives us the text without parsing JSON; that's what we want.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripeServerClient.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    // Bad signature OR malformed payload. Either way, do NOT 200.
    return NextResponse.json(
      { ok: false, error: `Signature verification failed: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  if (!EVENTS_HANDLED.has(event.type)) {
    // Stripe sends a wide range of events. Ack the ones we don't care
    // about so Stripe doesn't retry them, but log so an unexpected
    // type ever showing up is visible in logs.
    console.info(`[stripe-webhook] Ignored event type: ${event.type}`);
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const supabase = createSupabaseAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const stableId   = session.metadata?.stable_id;
        const customerId = typeof session.customer === "string" ? session.customer : null;
        if (!stableId || !customerId) {
          console.error("[stripe-webhook] checkout.session.completed missing stable_id or customer.", session.id);
          break;
        }
        // Pin the stripe customer to the stable. Idempotent: re-setting
        // the same id is a no-op; if the stable already has a different
        // customer attached, we keep the existing one (a re-checkout
        // shouldn't reassign).
        await supabase
          .from("stables")
          .update({ stripe_customer_id: customerId })
          .eq("id", stableId)
          .is("stripe_customer_id", null);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        // Rider Pro subscriptions live on clients table, not subscriptions/
        // stables. Branch by metadata.kind tag we set at Checkout creation.
        if (sub.metadata?.kind === "rider_pro") {
          await syncRiderProSubscription(supabase, sub);
        } else {
          await syncSubscription(supabase, sub);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        if (sub.metadata?.kind === "rider_pro") {
          await syncRiderProSubscription(supabase, sub, "canceled");
        } else {
          await syncSubscription(supabase, sub, "cancelled");
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
        if (!customerId) break;
        // Mark the subscription as past_due. The owner sees a banner
        // and can update the card via the Stripe portal.
        const { data: stable } = await supabase
          .from("stables")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();
        if (stable?.id) {
          await supabase
            .from("subscriptions")
            .update({ status: "past_due" })
            .eq("stable_id", stable.id);
        }
        break;
      }

      case "invoice.payment_succeeded": {
        // First charge or renewal succeeded. Trigger branded receipt email.
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
        if (!customerId) break;

        const ownerEmail = await getOwnerEmailByStripeCustomer(supabase, customerId);
        if (!ownerEmail) {
          console.warn("[stripe-webhook] payment_succeeded: no owner email resolved for", customerId);
          break;
        }

        const { sendEmail } = await import("@/lib/email/send");
        try {
          const amountMajor = (invoice.amount_paid / 100).toFixed(2);
          const currency    = (invoice.currency ?? "eur").toUpperCase();
          await sendEmail({
            to:       ownerEmail,
            subject:  `Receipt — Longrein €${amountMajor}`,
            html:     `<!doctype html><html><body style="font-family:-apple-system,sans-serif;background:#F4ECDF;padding:32px;color:#1B1B1B;">
<div style="max-width:520px;margin:0 auto;background:white;border-radius:16px;padding:32px;">
<p style="font-family:Georgia,serif;font-size:22px;color:#1E3A2A;margin:0 0 16px;">Longrein<span style="color:#B5793E;">.</span></p>
<h1 style="font-family:Georgia,serif;font-size:22px;color:#1E3A2A;margin:0 0 16px;">Payment received.</h1>
<p>Thank you. We've successfully charged ${amountMajor} ${currency} to your card on file.</p>
<p>Invoice link: <a href="${invoice.hosted_invoice_url ?? "https://app.longrein.eu/dashboard/settings/billing"}" style="color:#1E3A2A;">View receipt</a></p>
<p style="color:#6E6760;font-size:13px;">Manage your subscription any time at app.longrein.eu/dashboard/settings/billing</p>
</div>
</body></html>`,
            text:     `Payment received.\n\nThank you. We've successfully charged ${amountMajor} ${currency} to your card on file.\n\nReceipt: ${invoice.hosted_invoice_url ?? "https://app.longrein.eu/dashboard/settings/billing"}\n\nManage your subscription at app.longrein.eu/dashboard/settings/billing\n\n— Longrein`,
            // Idempotency on invoice id prevents duplicate receipts if Stripe retries the webhook.
            idempotencyKey: `receipt-${invoice.id}`,
          });
        } catch (err) {
          console.error("[stripe-webhook] receipt email failed:", err);
          // Don't fail the webhook — receipt is a nice-to-have, not correctness.
        }
        break;
      }

      case "customer.subscription.trial_will_end": {
        // Stripe fires this 3 days before the trial ends.
        // Hook for the Day 11 "your trial ends in 2 days" email.
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : null;
        if (!customerId) break;

        const ownerEmail = await getOwnerEmailByStripeCustomer(supabase, customerId);
        if (!ownerEmail) {
          console.warn("[stripe-webhook] trial_will_end: no owner email resolved for", customerId);
          break;
        }

        const { sendEmail } = await import("@/lib/email/send");
        try {
          const endDate = new Date(sub.trial_end ? sub.trial_end * 1000 : Date.now()).toLocaleDateString("en-GB");
          await sendEmail({
            to:       ownerEmail,
            subject:  "Your Longrein trial ends in 3 days.",
            html:     `<!doctype html><html><body style="font-family:-apple-system,sans-serif;background:#F4ECDF;padding:32px;color:#1B1B1B;">
<div style="max-width:520px;margin:0 auto;background:white;border-radius:16px;padding:32px;">
<p style="font-family:Georgia,serif;font-size:22px;color:#1E3A2A;margin:0 0 16px;">Longrein<span style="color:#B5793E;">.</span></p>
<h1 style="font-family:Georgia,serif;font-size:22px;color:#1E3A2A;margin:0 0 16px;">Your trial ends on ${endDate}.</h1>
<p>In three days, your card will be charged for the first month of Longrein. Nothing to do if you want to continue.</p>
<p>If Longrein isn't the fit, you can cancel any time before then in one click:</p>
<p><a href="https://app.longrein.eu/dashboard/settings/billing" style="display:inline-block;background:#1E3A2A;color:#F4ECDF;padding:12px 22px;border-radius:7px;text-decoration:none;font-weight:600;">Cancel trial</a></p>
<p style="color:#6E6760;font-size:13px;">Either way — thank you for trying Longrein.</p>
</div>
</body></html>`,
            text:     `Your trial ends on ${endDate}.\n\nIn three days, your card will be charged for the first month of Longrein. Nothing to do if you want to continue.\n\nCancel any time before then in one click:\nhttps://app.longrein.eu/dashboard/settings/billing\n\n— Longrein`,
            idempotencyKey: `trial-end-${sub.id}`,
          });
        } catch (err) {
          console.error("[stripe-webhook] trial-end email failed:", err);
        }
        break;
      }
    }
  } catch (err) {
    console.error("[stripe-webhook] handler error:", err);
    // 500 makes Stripe retry. That's correct — we don't want to drop
    // an event because of a transient DB blip.
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

// Find the stable by Stripe customer id and write the canonical
// subscription row + mirror onto stables.plan / trial_ends_at.
// Status override (5th arg) used by 'subscription.deleted' to force
// 'cancelled' regardless of what Stripe says.
async function syncSubscription(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  sub: Stripe.Subscription,
  forcedStatus?: "cancelled",
) {
  const customerId = typeof sub.customer === "string" ? sub.customer : null;
  if (!customerId) {
    console.error("[stripe-webhook] subscription event missing customer id", sub.id);
    return;
  }

  const { data: stable, error: stableErr } = await supabase
    .from("stables")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (stableErr || !stable?.id) {
    console.error("[stripe-webhook] no stable matches stripe customer", customerId, stableErr);
    return;
  }

  // GUARD: never overwrite a founder/demo stamp. BUG #OO (2026-05-28):
  // when a founder cancels the trial copy of their Stripe subscription
  // — or a demo subscription is cleaned up in Stripe — the resulting
  // 'customer.subscription.deleted' webhook would reset the canonical
  // subscription row from 'sub_founder_*' / 'sub_demo_*' back to the
  // Stripe id with status='cancelled', revoking founder access.
  // If the existing row carries a founder/demo marker, leave it alone.
  // Owners can always relink a real Stripe subscription later by going
  // through Checkout again.
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("stable_id", stable.id)
    .maybeSingle();
  const existingSubId = existing?.stripe_subscription_id ?? "";
  if (existingSubId.startsWith("sub_founder_") || existingSubId.startsWith("sub_demo_")) {
    console.info(
      "[stripe-webhook] skipping subscription sync — stable has founder/demo stamp",
      { stable: stable.id, marker: existingSubId },
    );
    return;
  }

  // In the Stripe 2026-04-22.dahlia API, current_period_start/end moved off
  // the Subscription root and onto each Subscription Item. We have a single
  // line item per subscription (one plan per stable), so reading item[0] is
  // safe; the optional chain guards against the empty-items edge case that
  // would only show up in malformed test events.
  const firstItem = sub.items.data[0];
  const priceId   = firstItem?.price.id ?? null;
  const plan      = priceIdToPlan(priceId);
  const status    = forcedStatus ?? mapStripeStatus(sub.status);

  const periodStartIso = firstItem?.current_period_start
    ? new Date(firstItem.current_period_start * 1000).toISOString()
    : null;
  const periodEndIso = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000).toISOString()
    : null;

  // Upsert the canonical subscription row. The stable already has one
  // from the migration-16 trigger, so this is normally an update.
  await supabase
    .from("subscriptions")
    .upsert(
      {
        stable_id:              stable.id,
        stripe_subscription_id: sub.id,
        stripe_price_id:        priceId,
        plan,
        status,
        current_period_start:   periodStartIso,
        current_period_end:     periodEndIso,
        cancel_at:              sub.cancel_at      ? new Date(sub.cancel_at      * 1000).toISOString() : null,
        cancelled_at:           sub.canceled_at    ? new Date(sub.canceled_at    * 1000).toISOString() : null,
      },
      { onConflict: "stable_id" },
    );

  // Mirror plan + trial_ends_at onto stables for fast UI reads.
  // (Re-uses periodEndIso computed above — same Dahlia API path through the
  // first subscription item.)
  await supabase
    .from("stables")
    .update({
      plan,
      trial_ends_at: status === "trialing" ? periodEndIso : null,
    })
    .eq("id", stable.id);
}

// =============================================================
// RIDER PRO — client-level €2/mo add-on. Lives on clients.* columns.
// =============================================================

async function syncRiderProSubscription(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  sub: Stripe.Subscription,
  forcedStatus?: "canceled",
) {
  const clientId = sub.metadata?.client_id;
  if (!clientId) {
    console.error("[stripe-webhook] rider_pro sub missing client_id metadata", sub.id);
    return;
  }

  const firstItem = sub.items.data[0];
  const periodEndIso = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000).toISOString()
    : null;
  const trialEndIso = sub.trial_end
    ? new Date(sub.trial_end * 1000).toISOString()
    : null;

  const status = forcedStatus ?? mapRiderProStatus(sub.status);

  await supabase
    .from("clients")
    .update({
      rider_pro_stripe_subscription_id: sub.id,
      rider_pro_status:                 status,
      rider_pro_trial_end:              trialEndIso,
      rider_pro_period_end:             periodEndIso,
      rider_pro_cancel_at_period_end:   Boolean(sub.cancel_at_period_end),
    })
    .eq("id", clientId);
}

function mapRiderProStatus(s: Stripe.Subscription.Status):
  "trialing" | "active" | "past_due" | "canceled" | "incomplete" {
  switch (s) {
    case "trialing":           return "trialing";
    case "active":             return "active";
    case "past_due":           return "past_due";
    case "canceled":           return "canceled";
    case "unpaid":             return "past_due";
    case "paused":             return "canceled";
    case "incomplete":
    case "incomplete_expired": return "incomplete";
    default:                   return "incomplete";
  }
}

function mapStripeStatus(s: Stripe.Subscription.Status):
  "trialing" | "active" | "past_due" | "cancelled" | "unpaid" | "paused" {
  switch (s) {
    case "trialing":           return "trialing";
    case "active":             return "active";
    case "past_due":           return "past_due";
    case "canceled":           return "cancelled";  // Stripe spells it 'canceled'; our enum is 'cancelled'.
    case "unpaid":             return "unpaid";
    case "paused":             return "paused";
    case "incomplete":
    case "incomplete_expired": return "unpaid";
    default:                   return "unpaid";
  }
}

// Resolve the stable-owner's email via the canonical chain:
//   stripe_customer_id → stables.id → profiles (role=owner) → auth.users.email
// Returns null if any link breaks. Callers should log + skip the email
// rather than fail the webhook — billing state correctness matters more
// than the receipt/reminder side-effect.
async function getOwnerEmailByStripeCustomer(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  customerId: string,
): Promise<string | null> {
  const { data: stable } = await supabase
    .from("stables")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (!stable?.id) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("auth_user_id")
    .eq("stable_id", stable.id)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  if (!profile?.auth_user_id) return null;

  const { data: { user }, error } = await supabase.auth.admin.getUserById(profile.auth_user_id);
  if (error || !user?.email) return null;
  return user.email;
}
