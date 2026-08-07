// MRR — the real one, from Stripe.
//
// The dashboard previously refused to show MRR at all, on the grounds
// that the codebase had no trustworthy plan→price map (Stripe price ids
// live in env vars, Founding Members are hand-billed, FREE_MODE is on).
// That reasoning was right about the plan→price map and wrong about the
// conclusion: Stripe already knows what every subscription costs, and
// asking it is both easier and more correct than maintaining a mirror.
//
// So there are now two sources, in priority order:
//
//   1. Stripe, when STRIPE_SECRET_KEY is set. Authoritative. Counts only
//      `active` subscriptions, normalises every billing interval to a
//      month, and reports (rather than converts) anything not in euro.
//   2. The plan prices she typed into Settings, when Stripe isn't
//      configured. An estimate, and labelled as one in the UI.
//
// If neither is available the answer is still null, and the card still
// says so. A made-up MRR on a dashboard she makes decisions from is
// worse than a blank one.

import { stripeServerClient } from "@/lib/stripe/server";
import { safe } from "@/services/personalDashboard/common";
import { computeMrr, type SubscriptionLite } from "@/services/personalDashboard/ops.pure";

export type MrrSnapshot = {
  /** Euro per month. Null when no source could produce a number. */
  mrr: number | null;
  source: "stripe" | "manual" | null;
  /** Subscriptions that contributed. */
  counted: number;
  /** Priced in a currency this dashboard won't guess an exchange rate for. */
  skippedForeignCurrency: number;
};

const NONE: MrrSnapshot = { mrr: null, source: null, counted: 0, skippedForeignCurrency: 0 };

/** Stripe is a third party on a page-render path. Cap the wait. */
const TIMEOUT_MS = 6000;

/** Enough for any plausible near-term subscriber count, and a hard stop
 *  so a runaway page loop can't walk an unbounded list. */
const MAX_SUBSCRIPTIONS = 500;

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Live MRR from Stripe, or null when Stripe isn't configured / the call
 * failed. Callers fall back to the manual plan prices.
 */
export async function getStripeMrr(): Promise<MrrSnapshot> {
  if (!stripeConfigured()) return NONE;

  return safe<MrrSnapshot>(
    async () => {
      const subscriptions = await withTimeout(fetchActiveSubscriptions(), TIMEOUT_MS);
      if (subscriptions === null) return NONE;

      const result = computeMrr(subscriptions, { currency: "eur" });
      return {
        mrr: result.mrr,
        source: "stripe",
        counted: result.counted,
        skippedForeignCurrency: result.skippedForeignCurrency,
      };
    },
    NONE,
    "getStripeMrr",
  );
}

async function fetchActiveSubscriptions(): Promise<SubscriptionLite[]> {
  const out: SubscriptionLite[] = [];

  // `status: "active"` is applied by Stripe, not by us — no point paging
  // through cancelled history to filter it out here.
  for await (const sub of stripeServerClient.subscriptions.list({
    status: "active",
    limit: 100,
  })) {
    out.push({
      status: sub.status,
      items: (sub.items?.data ?? []).map((item) => {
        const price = item.price;
        return {
          unitAmount: price?.unit_amount ?? null,
          currency: price?.currency ?? "",
          // A one-off price has no `recurring` block. Mapping it to an
          // empty interval makes monthlyEurOfItem return 0, which is the
          // right contribution for something that isn't recurring revenue.
          interval: price?.recurring?.interval ?? "",
          intervalCount: price?.recurring?.interval_count ?? 1,
          quantity: item.quantity ?? 1,
        };
      }),
    });
    if (out.length >= MAX_SUBSCRIPTIONS) break;
  }

  return out;
}

/** Resolve to null rather than hanging the render. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
