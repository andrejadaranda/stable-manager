"use client";

// RiderProPaywall — shown to stable clients who haven't upgraded yet.
// Renders inside /dashboard/sessions/live in place of the LiveTracker.
//
// CTA fires POST /api/stripe/rider-pro/checkout and redirects to Stripe.

import { useState } from "react";

export function RiderProPaywall({
  reason,
}: {
  reason: "client-needs-upgrade" | "stable-inactive" | string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onUpgrade() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/rider-pro/checkout", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || `HTTP ${res.status}`);
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start checkout");
      setBusy(false);
    }
  }

  if (reason === "stable-inactive") {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-ink-100 shadow-soft p-6 text-center space-y-3">
        <h2 className="font-display text-xl text-navy-700">Stable subscription is inactive</h2>
        <p className="text-sm text-ink-500">
          Ask your stable owner to reactivate billing. Live ride tracking will reopen automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden">
        {/* Header pill */}
        <div className="bg-paddock text-white px-6 py-4 flex items-center justify-between">
          <span className="font-display text-lg">Rider Pro</span>
          <span className="text-xs uppercase tracking-wider opacity-80 font-semibold">Add-on</span>
        </div>

        {/* Pricing */}
        <div className="px-6 pt-6 text-center">
          <div className="flex items-baseline justify-center gap-1">
            <span className="font-display text-5xl text-navy-700">€2</span>
            <span className="text-sm text-ink-500">/month</span>
          </div>
          <p className="text-[12.5px] text-ink-500 mt-2">
            14-day free trial · Cancel any time
          </p>
        </div>

        {/* Features */}
        <ul className="px-6 py-5 space-y-3 text-sm text-ink-700">
          <Feature>Live GPS ride tracker — route, distance, speed</Feature>
          <Feature>Gait breakdown — walk / trot / canter / gallop time</Feature>
          <Feature>Elevation profile, calories, per-km splits</Feature>
          <Feature>Shareable post-ride card for Instagram / Facebook</Feature>
          <Feature>Full ride history with route library</Feature>
        </ul>

        {/* CTA */}
        <div className="px-6 pb-6">
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 mb-3">
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={onUpgrade}
            disabled={busy}
            className="
              w-full h-12 rounded-xl text-base font-semibold text-white
              bg-brand-600 hover:bg-brand-700 active:bg-brand-800
              transition-colors disabled:opacity-50
              focus:outline-none focus:ring-4 focus:ring-brand-500/30
            "
          >
            {busy ? "Opening checkout…" : "Start 14-day free trial"}
          </button>
          <p className="text-[11px] text-ink-400 text-center mt-3 leading-relaxed">
            Card required. We charge €2 only after your trial ends. Cancel any time before then and you won't be billed.
          </p>
        </div>
      </div>

      <p className="text-[12px] text-ink-500 text-center mt-4 leading-relaxed">
        Riding for fun without GPS? You can still <strong>log past sessions</strong> for free from your dashboard.
      </p>
    </div>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="text-saddle mt-0.5">✓</span>
      <span>{children}</span>
    </li>
  );
}
