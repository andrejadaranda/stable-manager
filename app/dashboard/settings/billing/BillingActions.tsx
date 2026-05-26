"use client";

// Client component for the "Start trial" + "Manage subscription" buttons.
// Both POST to a server route, take the returned Stripe-hosted URL, and
// redirect the browser there. The Stripe hosted page handles all card
// collection, plan changes, cancellation, dunning — we never own that UI.

import { useState } from "react";

type Props = {
  kind:    "start" | "manage";
  label?:  string;
  // When true, hides the "No card charged during the trial" helper line —
  // used for the trial-expired / reactivate flow where the user IS being
  // charged immediately.
  immediateCharge?: boolean;
  // Demo guard — when the underlying subscription was inserted directly
  // (marketing-demo seed) without going through Stripe Checkout, the
  // stripe_subscription_id is a placeholder like "sub_demo_...". Hitting
  // the Stripe portal with one of those IDs returns a hard 404. Disable
  // the button + show a tooltip instead of letting users fail.
  isDemoSubscription?: boolean;
};

export function BillingActions({ kind, label, immediateCharge, isDemoSubscription }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultLabel = kind === "start" ? "Start your 14-day trial" : "Manage subscription";
  const endpoint     = kind === "start" ? "/api/stripe/checkout"   : "/api/stripe/billing-portal";
  const demoBlocked  = kind === "manage" && isDemoSubscription;

  async function onClick() {
    if (demoBlocked) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const body = await res.json().catch(() => ({} as { ok?: boolean; url?: string; error?: string }));
      if (!res.ok || !body.ok || !body.url) {
        throw new Error(body.error ?? "Something went wrong. Try again in a moment.");
      }
      window.location.href = body.url;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={busy || demoBlocked}
        title={demoBlocked ? "This is a demo subscription. Sign up a real account to manage billing." : undefined}
        className="inline-flex w-fit items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-sm font-medium text-surface hover:bg-brand-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {busy ? "Opening…" : (label ?? defaultLabel)}
      </button>
      {demoBlocked && (
        <p className="text-[12px] text-ink-500 italic">Demo subscription — Stripe portal disabled.</p>
      )}
      {kind === "start" && !immediateCharge && (
        <p className="text-[12px] text-ink-500 italic">No card charged during the trial — cancel any time before day 14.</p>
      )}
      {kind === "start" && immediateCharge && (
        <p className="text-[12px] text-ink-500 italic">You'll be charged €49 immediately and can cancel any time from the billing page.</p>
      )}
      {error && (
        <p className="text-[13px] text-red-700 mt-1">{error}</p>
      )}
    </div>
  );
}
