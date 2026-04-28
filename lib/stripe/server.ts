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

export type Plan = "starter" | "pro" | "premium";

// Map plan → Stripe price id. Configure these in your Stripe dashboard
// (Products → add product per tier) and copy the price ids into env.
export const PRICE_IDS: Record<Plan, string> = {
  starter: process.env.STRIPE_PRICE_STARTER ?? "",
  pro:     process.env.STRIPE_PRICE_PRO     ?? "",
  premium: process.env.STRIPE_PRICE_PREMIUM ?? "",
};

export function priceIdToPlan(priceId: string | null | undefined): "trial" | Plan {
  if (!priceId) return "trial";
  if (priceId === PRICE_IDS.starter) return "starter";
  if (priceId === PRICE_IDS.pro)     return "pro";
  if (priceId === PRICE_IDS.premium) return "premium";
  return "trial";
}
