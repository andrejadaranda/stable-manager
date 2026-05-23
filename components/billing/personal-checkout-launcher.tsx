"use client";

// Fires POST /api/stripe/checkout/personal and redirects the browser
// to the Stripe-hosted Checkout page. Lives on /dashboard/personal-checkout
// — the page personal accounts get bounced to until they pay.

import { useEffect, useState } from "react";

export function PersonalCheckoutLauncher() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy]   = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/stripe/checkout/personal", { method: "POST" });
        const data = (await res.json()) as { ok: boolean; url?: string; error?: string };
        if (cancelled) return;
        if (!data.ok || !data.url) {
          setError(data.error ?? "Could not start checkout.");
          setBusy(false);
          return;
        }
        window.location.href = data.url;
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message || "Network error.");
        setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setBusy(true);
            window.location.reload();
          }}
          className="rounded-md bg-brand-600 text-white py-2.5 px-4 text-sm font-medium hover:bg-brand-700"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      className="rounded-md bg-brand-600 text-white py-3 px-5 text-sm font-medium hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {busy ? "Redirecting to Stripe…" : "Continue to payment"}
    </button>
  );
}
