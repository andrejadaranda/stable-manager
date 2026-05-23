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
};

export function BillingActions({ kind, label, immediateCharge }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultLabel = kind === "start" ? "Start your 14-day trial" : "Manage subscription";
  const endpoint     = kind === "start" ? "/api/stripe/checkout"   : "/api/stripe/billing-portal";

  async function onClick() {
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
        disabled={busy}
        className="inline-flex w-fit items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-sm font-medium text-surface hover:bg-brand-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {busy ? "Opening…" : (label ?? defaultLabel)}
      </button>
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
