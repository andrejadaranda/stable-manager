// POST /api/stripe/checkout/personal
//
// Creates a Stripe Checkout Session for a freshly provisioned personal
// (B2C) account. Two tiers:
//   - Mini  → €9/mo, up to 2 horses  (STRIPE_PRICE_PERSONAL_MINI)
//   - Plus  → €15/mo, up to 5 horses (STRIPE_PRICE_PERSONAL_PLUS)
//
// Body: { tier: "mini" | "plus" }  — optional; defaults to whatever the
// user picked at signup (stables.personal_plan_tier).
//
// Flow:
//   1. User signs up at /signup/personal → provision_personal_account RPC
//      creates a stable with account_type='personal' + personal_plan_tier.
//   2. After login, /dashboard redirects them here (or they hit a "Start
//      14-day trial" CTA in the personal billing UI).
//   3. We pick the right price ID from the stable.personal_plan_tier (or
//      override via body), create a Stripe Checkout Session, return URL.
//   4. Stripe Checkout collects card → webhook updates subscriptions.
//   5. Personal account becomes "active" → middleware lets them in.

import { NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { stripeServerClient, PRICE_IDS } from "@/lib/stripe/server";
import { FREE_MODE } from "@/lib/config/freeMode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.longrein.eu";

type CheckoutBody = { tier?: "mini" | "plus" };

export async function POST(req: Request) {
  // FREE_MODE (early access): never create a Checkout Session — the app is free.
  if (FREE_MODE) {
    return NextResponse.json(
      { ok: false, error: "Longrein is free during early access — no payment needed." },
      { status: 200 },
    );
  }

  // Auth — only the personal account owner can trigger their own checkout.
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
      return NextResponse.json({ ok: false, error: "Only account owners can manage billing." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: "Session error." }, { status: 401 });
  }

  if (session.accountType !== "personal") {
    return NextResponse.json(
      { ok: false, error: "This endpoint is for personal accounts only. Use /api/stripe/checkout for stable subscriptions." },
      { status: 400 },
    );
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { ok: false, error: "Billing not yet configured. Try again shortly or contact hello@longrein.eu." },
      { status: 503 },
    );
  }

  const supabase = createSupabaseAdminClient();

  // Read the stable to get the user's chosen tier + existing Stripe customer (if any).
  const { data: stable, error: stableErr } = await supabase
    .from("stables")
    .select("id, name, stripe_customer_id, personal_plan_tier")
    .eq("id", session.stableId)
    .single();
  if (stableErr || !stable) {
    return NextResponse.json(
      { ok: false, error: "Account not found. Contact hello@longrein.eu." },
      { status: 500 },
    );
  }

  // Body tier overrides stored preference (handy for an in-app plan switcher).
  let body: CheckoutBody = {};
  try { body = (await req.json()) as CheckoutBody; } catch { /* empty body is fine */ }
  const tier = body.tier ?? stable.personal_plan_tier ?? "mini";
  if (tier !== "mini" && tier !== "plus") {
    return NextResponse.json(
      { ok: false, error: "Invalid plan tier — must be 'mini' or 'plus'." },
      { status: 400 },
    );
  }

  const priceId = tier === "mini" ? PRICE_IDS.personal_mini : PRICE_IDS.personal_plus;
  if (!priceId) {
    return NextResponse.json(
      { ok: false, error: `Personal ${tier} plan price not configured. Contact hello@longrein.eu.` },
      { status: 503 },
    );
  }

  // Owner email — needed for the Stripe Customer record on first checkout.
  const { data: { user } } = await supabase.auth.admin.getUserById(session.authUserId);
  const ownerEmail = user?.email;
  if (!ownerEmail) {
    return NextResponse.json(
      { ok: false, error: "Could not resolve account email. Contact hello@longrein.eu." },
      { status: 500 },
    );
  }

  // Reuse the existing Stripe customer (e.g. plan switch) or create one.
  let customerId = stable.stripe_customer_id;
  if (!customerId) {
    const customer = await stripeServerClient.customers.create({
      email:    ownerEmail,
      name:     stable.name,
      metadata: { stable_id: stable.id, account_type: "personal" },
    });
    customerId = customer.id;
    await supabase
      .from("stables")
      .update({ stripe_customer_id: customerId })
      .eq("id", stable.id);
  }

  // 7-day free trial for Personal (Stable plan gets 14-day). Card required
  // at signup — trial converts into the €9 / €15 charge automatically unless
  // cancelled in the Stripe Customer Portal before day 7. The trial-farming
  // guards (SEC-13/14/15: disposable email block + IP rate limit + card-on-file)
  // already cover Personal because signup goes through anti-abuse.ts.
  // Subscription state is synced both via the Stripe webhook AND on the
  // success_url redirect (lib/stripe/sync.ts) so the user is never stuck.
  const checkoutSession = await stripeServerClient.checkout.sessions.create({
    mode:                "subscription",
    customer:            customerId,
    line_items:          [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 7,
      metadata:    { stable_id: stable.id, account_type: "personal", plan_tier: tier },
      description: `Longrein Personal ${tier === "mini" ? "Mini" : "Plus"} — ${stable.name}`,
    },
    custom_text: {
      submit:              { message: "You'll only be charged after the 7-day free trial. Cancel any time before then." },
      terms_of_service_acceptance: {
        message: "By starting your subscription you agree to the Longrein [Terms](https://longrein.eu/legal/terms) and [Privacy Policy](https://longrein.eu/legal/privacy).",
      },
    },
    consent_collection:         { terms_of_service: "required" },
    payment_method_collection:  "always",
    success_url: `${APP_URL}/dashboard?welcome=personal&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${APP_URL}/dashboard?billing_cancelled=true`,
    metadata:    { stable_id: stable.id, account_type: "personal", plan_tier: tier },
    tax_id_collection:          { enabled: true },
    customer_update:            { name: "auto", address: "auto" },
    billing_address_collection: "auto",
    locale:                     "auto",
    allow_promotion_codes:      true,
  });

  return NextResponse.json({ ok: true, url: checkoutSession.url });
}
