// Personal account checkout wait page.
//
// After signup, personal accounts don't have a subscription yet —
// middleware sends them here. This page fires POST /api/stripe/checkout/personal
// client-side and redirects to Stripe Checkout. If Stripe is not yet
// configured (price IDs missing), surfaces a friendly error.

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { PersonalCheckoutLauncher } from "@/components/billing/personal-checkout-launcher";
import { FREE_MODE } from "@/lib/config/freeMode";

export const dynamic = "force-dynamic";

export default async function PersonalCheckoutPage() {
  // FREE_MODE (early access): never send anyone to Stripe Checkout — the app
  // is free. Bounce to the dashboard. Reverts when FREE_MODE is flipped off.
  if (FREE_MODE) redirect("/dashboard");

  const session = await getSession().catch(() => null);
  if (!session) redirect("/login");
  if (session.role !== "owner" || session.accountType !== "personal") {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-md mx-auto mt-20 bg-white rounded-2xl shadow-soft p-8 text-center">
      <span aria-hidden className="text-3xl">💳</span>
      <h1 className="font-display text-2xl text-navy-900 mt-3">
        One last step — payment
      </h1>
      <p className="text-sm text-ink-600 mt-2">
        Your personal account is ready. Add a payment method to start using
        Longrein. You can cancel any time.
      </p>

      <div className="mt-6">
        <PersonalCheckoutLauncher />
      </div>

      <p className="text-[11.5px] text-ink-500 mt-6">
        Stuck?{" "}
        <Link href="mailto:hello@longrein.eu" className="text-brand-700 hover:text-brand-800 underline-offset-2 hover:underline">
          Email hello@longrein.eu
        </Link>{" "}
        and we'll set it up manually.
      </p>
    </div>
  );
}
