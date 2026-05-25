// POST /api/stripe/rider-pro/checkout
//
// Client-side €2/mo Rider Pro add-on. Independent of the stable's
// subscription — the client pays directly with their own card.
//
// Flow:
//   1. Stable client taps "Start 14-day free trial" on the paywall
//   2. POST here (no body — server reads client.id from session)
//   3. Create or reuse a per-client Stripe Customer
//   4. Create Checkout Session in subscription mode + 14-day trial
//   5. Webhook (POST /api/stripe/webhook) handles
//      customer.subscription.* events with metadata.kind=rider_pro
//      and updates clients.rider_pro_* columns.

import { NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { stripeServerClient, PRICE_IDS } from "@/lib/stripe/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.longrein.eu";

export async function POST() {
  // Auth — only stable clients hit this endpoint. Owners/employees
  // get Rider Pro for free as part of the stable plan; Personal accounts
  // get it bundled. The paywall doesn't render for those roles.
  let session;
  try {
    session = await getSession();
    requireRole(session, "client");
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ error: "Rider Pro is for stable clients." }, { status: 403 });
    }
    return NextResponse.json({ error: "Session error." }, { status: 401 });
  }

  if (!session.clientId) {
    return NextResponse.json(
      { error: "Your client profile isn't linked yet. Contact your stable owner." },
      { status: 400 },
    );
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Billing not configured." }, { status: 503 });
  }

  const priceId = PRICE_IDS.rider_pro;
  if (!priceId) {
    return NextResponse.json(
      { error: "Rider Pro not configured. Contact hello@longrein.eu." },
      { status: 503 },
    );
  }

  const supabase = createSupabaseAdminClient();

  // Load the client row — we need its existing Stripe customer id (if any)
  // and check whether the trial has been used before.
  const { data: client, error: cErr } = await supabase
    .from("clients")
    .select("id, full_name, email, profile_id, rider_pro_stripe_customer_id, rider_pro_trial_end")
    .eq("id", session.clientId)
    .single();
  if (cErr || !client) {
    return NextResponse.json({ error: "Client profile not found." }, { status: 500 });
  }

  // If trial already passed, skip the free trial (one shot).
  const trialAlreadyUsed =
    client.rider_pro_trial_end != null &&
    new Date(client.rider_pro_trial_end).getTime() <= Date.now();

  // Resolve the rider's email — prefer the client.email if recorded,
  // otherwise fall back to auth.users.email on their profile.
  let riderEmail: string | null = client.email ?? null;
  if (!riderEmail && client.profile_id) {
    const { data: { user } } = await supabase.auth.admin.getUserById(session.authUserId);
    riderEmail = user?.email ?? null;
  }
  if (!riderEmail) {
    return NextResponse.json(
      { error: "Couldn't resolve your email. Contact your stable owner." },
      { status: 500 },
    );
  }

  // Reuse the per-client Stripe customer, else create one.
  let customerId = client.rider_pro_stripe_customer_id;
  if (!customerId) {
    const customer = await stripeServerClient.customers.create({
      email:    riderEmail,
      name:     client.full_name ?? undefined,
      metadata: {
        kind:       "rider_pro",
        client_id:  client.id,
        stable_id:  session.stableId,
      },
    });
    customerId = customer.id;

    await supabase
      .from("clients")
      .update({ rider_pro_stripe_customer_id: customerId })
      .eq("id", client.id);
  }

  const checkoutSession = await stripeServerClient.checkout.sessions.create({
    mode:                "subscription",
    customer:            customerId,
    line_items:          [{ price: priceId, quantity: 1 }],
    subscription_data: {
      ...(trialAlreadyUsed ? {} : { trial_period_days: 14 }),
      metadata: {
        kind:      "rider_pro",
        client_id: client.id,
        stable_id: session.stableId,
      },
      description: "Longrein Rider Pro — live GPS tracker + advanced ride analytics",
    },
    custom_text: {
      submit: {
        message: trialAlreadyUsed
          ? "You'll be charged €2/month starting today. Cancel any time."
          : "You'll only be charged €2/month after the 14-day free trial.",
      },
      terms_of_service_acceptance: {
        message: "By starting your subscription you agree to the Longrein [Terms](https://longrein.eu/legal/terms) and [Privacy Policy](https://longrein.eu/legal/privacy).",
      },
    },
    consent_collection: { terms_of_service: "required" },
    payment_method_collection: "always",
    success_url: `${APP_URL}/dashboard/sessions/live?rider_pro=started&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${APP_URL}/dashboard/sessions/live?rider_pro=cancelled`,
    metadata: {
      kind:      "rider_pro",
      client_id: client.id,
      stable_id: session.stableId,
    },
    customer_update: { name: "auto", address: "auto" },
    billing_address_collection: "auto",
    locale: "auto",
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
