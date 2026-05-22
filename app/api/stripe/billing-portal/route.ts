// POST /api/stripe/billing-portal
//
// Creates a Stripe Billing Portal session for the current owner to:
//   - Cancel their subscription (one-click — REQUIRED for trial users
//     per the locked launch decision)
//   - Update card on file
//   - Download invoices / receipts
//   - Change plan (post-M2 when we have multiple tiers live)
//
// We don't build a custom billing UI for any of this — Stripe's hosted
// portal handles every edge case (proration, tax IDs, dunning, EU VAT
// invoicing) better than we could in two weeks of work. Configure the
// portal once in Stripe Dashboard → Settings → Billing → Customer portal.

import { NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { stripeServerClient } from "@/lib/stripe/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.longrein.eu";

export async function POST() {
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
      { ok: false, error: "Billing not yet configured." },
      { status: 503 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data: stable } = await supabase
    .from("stables")
    .select("id, stripe_customer_id")
    .eq("id", session.stableId)
    .single();

  if (!stable?.stripe_customer_id) {
    // Owner has never started a subscription — there's nothing to manage.
    // Redirect them to start a trial instead.
    return NextResponse.json(
      { ok: false, error: "No active subscription. Start your trial first." },
      { status: 404 },
    );
  }

  const portal = await stripeServerClient.billingPortal.sessions.create({
    customer:   stable.stripe_customer_id,
    return_url: `${APP_URL}/dashboard/settings/billing`,
  });

  return NextResponse.json({ ok: true, url: portal.url });
}
