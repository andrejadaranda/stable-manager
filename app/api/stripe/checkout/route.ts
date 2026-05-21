// POST /api/stripe/checkout
//
// Creates a Stripe Checkout Session for the current owner to start a
// 14-day trial subscription. Card REQUIRED at signup (Netflix model);
// the trial converts into a paid subscription automatically unless the
// owner cancels via /api/stripe/billing-portal before day 14.
//
// Pricing decision (locked 2026-05-21):
//   - Standard plan: €49/mo (uses STRIPE_PRICE_PRO env var as price id)
//   - Founding 15 members: €25/mo lifetime, 12 months free, €299 one-time
//     onboarding fee — handled MANUALLY via Stripe Dashboard invoices,
//     NOT via this self-serve checkout. Founding Members never enter
//     this flow during their first 12 months.
//
// Flow:
//   1. Owner clicks "Start your 14-day trial" on /dashboard/settings/billing
//   2. POST here with no body (server reads stable from session)
//   3. We create/reuse a Stripe Customer for the stable
//   4. We create a Checkout Session in subscription mode + trial_period_days=14
//   5. We return the Checkout URL; client redirects
//   6. Stripe handles card collection on hosted page (PCI scope — never our problem)
//   7. After completion, Stripe webhook updates subscriptions table
//   8. User redirects back to /dashboard/settings/billing?started=true

import { NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { stripeServerClient, PRICE_IDS } from "@/lib/stripe/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.longrein.eu";

export async function POST() {
  // Auth — only stable owners can trigger checkout.
  let session;
  try {
    session = await getSession();
    requireRole(session, "owner");
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "UNAUTHENTICATED") {
      return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ ok: false, error: "Only stable owners can manage billing." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: "Session error." }, { status: 401 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { ok: false, error: "Billing not yet configured. Try again shortly or contact hello@longrein.eu." },
      { status: 503 },
    );
  }

  const priceId = PRICE_IDS.pro;  // The single launch tier — €49/mo.
  if (!priceId) {
    return NextResponse.json(
      { ok: false, error: "Billing plan not yet configured. Contact hello@longrein.eu." },
      { status: 503 },
    );
  }

  // Use admin client to look up/update the stable's stripe_customer_id
  // (the RLS-aware client would also work, but admin is faster + clearer).
  const supabase = createSupabaseAdminClient();

  const { data: stable, error: stableErr } = await supabase
    .from("stables")
    .select("id, name, stripe_customer_id")
    .eq("id", session.stableId)
    .single();

  if (stableErr || !stable) {
    return NextResponse.json(
      { ok: false, error: "Stable not found. Contact hello@longrein.eu." },
      { status: 500 },
    );
  }

  // Get the owner's email for the customer record. We use the canonical
  // auth.users.email rather than any cached column to stay schema-light.
  const { data: { user } } = await supabase.auth.admin.getUserById(session.authUserId);
  const ownerEmail = user?.email;
  if (!ownerEmail) {
    return NextResponse.json(
      { ok: false, error: "Could not resolve account email. Contact hello@longrein.eu." },
      { status: 500 },
    );
  }

  // Reuse the stable's existing Stripe customer if we have one; otherwise create.
  let customerId = stable.stripe_customer_id;
  if (!customerId) {
    const customer = await stripeServerClient.customers.create({
      email:    ownerEmail,
      name:     stable.name,
      metadata: { stable_id: stable.id },
    });
    customerId = customer.id;

    // Pin the customer id onto the stable. The Stripe webhook also does
    // this on checkout.session.completed, but doing it here too means
    // duplicate Checkout Sessions for the same stable always reuse the
    // same Stripe customer (no orphaned customers piling up).
    await supabase
      .from("stables")
      .update({ stripe_customer_id: customerId })
      .eq("id", stable.id);
  }

  // Create the Checkout Session. trial_period_days=14 is THE mechanism
  // for the locked launch decision (14-day trial, card required, never
  // charged during trial). Stripe also fires customer.subscription.trial_will_end
  // 3 days before the end, which our webhook turns into the Day 11 reminder email.
  const checkoutSession = await stripeServerClient.checkout.sessions.create({
    mode:                "subscription",
    customer:            customerId,
    line_items:          [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { stable_id: stable.id },
    },
    payment_method_collection: "always",  // Card REQUIRED at signup.
    success_url: `${APP_URL}/dashboard/settings/billing?started=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${APP_URL}/dashboard/settings/billing?cancelled=true`,
    metadata:    { stable_id: stable.id },
    // Allow the user to enter a tax ID if they're a business (Lithuania,
    // EU VAT, etc.). Optional from their end, but legal-clean for invoices.
    tax_id_collection: { enabled: true },
    // EU compliance — let the user choose currency display + locale.
    // Stripe auto-detects from billing address; this just controls the
    // initial page language.
    locale: "auto",
  });

  return NextResponse.json({ ok: true, url: checkoutSession.url });
}
