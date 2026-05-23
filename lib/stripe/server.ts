// Stripe server client. Server-only — never import from a client component.
// Requires `npm install stripe`.

import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  // Don't throw at import time in dev — it would break the whole app.
  // The handler that uses this will throw a clean error instead.
  if (process.env.NODE_ENV === "production") {
    console.error("[stripe] STRIPE_SECRET_KEY is not set");
  }
}

export const stripeServerClient = new Stripe(
  process.env.STRIPE_SECRET_KEY ?? "sk_test_dummy",
  { apiVersion: "2026-04-22.dahlia" },
);

export type Plan =
  | "starter"
  | "pro"
  | "premium"
  | "founding"          // €25/mo Founding 15 stable owner lifetime
  | "personal_mini"     // €9/mo, up to 2 horses (B2C)
  | "personal_plus";    // €15/mo, up to 5 horses (B2C)

// Map plan → Stripe price id. Configure these in your Stripe dashboard
// (Products → add product per tier) and copy the price ids into env.
export const PRICE_IDS: Record<Plan, string> = {
  starter:        process.env.STRIPE_PRICE_STARTER        ?? "",
  pro:            process.env.STRIPE_PRICE_PRO            ?? "",
  premium:        process.env.STRIPE_PRICE_PREMIUM        ?? "",
  founding:       process.env.STRIPE_PRICE_FOUNDING       ?? "",
  personal_mini:  process.env.STRIPE_PRICE_PERSONAL_MINI  ?? "",
  personal_plus:  process.env.STRIPE_PRICE_PERSONAL_PLUS  ?? "",
};

export function priceIdToPlan(priceId: string | null | undefined): "trial" | Plan {
  if (!priceId) return "trial";
  for (const [plan, id] of Object.entries(PRICE_IDS) as Array<[Plan, string]>) {
    if (id && priceId === id) return plan;
  }
  return "trial";
}
