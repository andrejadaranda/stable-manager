// Billing settings page.
//
// State-driven UI:
//   - No subscription → "Start your 14-day trial" CTA (card required)
//   - Trialing       → trial end countdown + "Manage subscription"
//   - Active         → plan info + "Manage subscription"
//   - Past due       → red banner + "Update payment method"
//   - Cancelled      → "Reactivate"
//
// All state-changing actions route through Stripe's hosted Billing Portal —
// we never build cancel/update-card/change-plan forms ourselves.

import { requirePageRole } from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncSubscriptionFromCheckoutSession } from "@/lib/stripe/sync";
import { getSession } from "@/lib/auth/session";
import { Card, CardHeader, Badge } from "@/components/ui";
import { BillingActions } from "./BillingActions";

type SubscriptionRow = {
  status:                 "trialing" | "active" | "past_due" | "cancelled" | "unpaid" | "paused";
  plan:                   "trial" | "starter" | "pro" | "premium" | "cancelled";
  current_period_end:     string | null;
  cancel_at:              string | null;
  cancelled_at:           string | null;
  stripe_subscription_id: string | null;
};

export default async function BillingSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ started?: string; cancelled?: string; session_id?: string }>;
}) {
  await requirePageRole("owner");
  const params = (await searchParams) ?? {};

  // Belt-and-braces: if Stripe redirected back here with a session_id,
  // sync the subscription state directly. Without this, a user who
  // completes Checkout can still see "no subscription" on this page
  // until the webhook arrives (which can lag or fail). See lib/stripe/sync.ts.
  if (params.session_id) {
    try {
      const session = await getSession();
      if (session.stableId) {
        await syncSubscriptionFromCheckoutSession(params.session_id, session.stableId);
      }
    } catch (err) {
      console.error("[billing-page] post-checkout sync failed:", err);
    }
  }

  const supabase = createSupabaseServerClient();
  // RLS allows owner to SELECT their own stable's subscription row.
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, plan, current_period_end, cancel_at, cancelled_at, stripe_subscription_id")
    .maybeSingle();

  const subscription = sub as SubscriptionRow | null;
  const hasActiveStripe = Boolean(subscription?.stripe_subscription_id);
  const statusIsTrialing = subscription?.status === "trialing";
  const isActive   = subscription?.status === "active";
  const isPastDue  = subscription?.status === "past_due";
  const isCancelled = subscription?.status === "cancelled" || subscription?.plan === "cancelled";

  // "Effective" trial state — only treat as a real ongoing trial if:
  //   (a) the current_period_end hasn't lapsed, AND
  //   (b) the user has actually attached a card via Stripe Checkout
  //       (stripe_subscription_id != null). Without (b), the seed trigger's
  //       initial 'trialing' row would let users farm trials by signing up
  //       with a new email — never paying, never attaching a card.
  // Falling into !isTrialing without (b) sends them through the
  // "Start your 14-day trial" CTA which fires Stripe Checkout.
  const trialEndMs = subscription?.current_period_end
    ? new Date(subscription.current_period_end).getTime()
    : null;
  const isTrialing =
    statusIsTrialing &&
    trialEndMs != null &&
    trialEndMs > Date.now() &&
    hasActiveStripe;
  // Trial row exists but it's already lapsed AND a card was previously
  // attached — show the "trial expired" UI (offer restart).
  const isTrialExpired =
    statusIsTrialing && trialEndMs != null && trialEndMs <= Date.now() && hasActiveStripe;

  const trialEndDate = trialEndMs && isTrialing
    ? new Date(trialEndMs).toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
      })
    : null;

  const daysLeft = trialEndMs && isTrialing
    ? Math.max(0, Math.ceil((trialEndMs - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Post-checkout flash messages */}
      {params.started === "true" && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
          Your trial is active. We've emailed you a receipt — check your inbox for next steps.
        </div>
      )}
      {params.cancelled === "true" && (
        <div className="rounded-xl border border-ink-200 bg-ink-50 p-4 text-sm text-ink-700">
          Checkout was cancelled. You can start the trial whenever you're ready.
        </div>
      )}
      {isPastDue && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <strong>Payment failed.</strong> Update your card to keep your stable active.
        </div>
      )}

      <Card padded={false}>
        <CardHeader
          title="Plan"
          subtitle="Your Longrein subscription."
          action={
            isActive       ? <Badge tone="success" dot>Active</Badge>
            : isTrialing    ? <Badge tone="brand"   dot>14-day trial</Badge>
            : isTrialExpired ? <Badge tone="warning" dot>Trial expired</Badge>
            : isPastDue     ? <Badge tone="warning" dot>Past due</Badge>
            : isCancelled   ? <Badge tone="neutral" dot>Cancelled</Badge>
            : <Badge tone="neutral" dot>Not started</Badge>
          }
        />
        <div className="p-6 flex flex-col gap-4">
          {/* Never-started (no row OR trial row exists but has lapsed and was
              never tied to a real Stripe subscription). Mutually exclusive
              with the isTrialing block below — handled by isTrialing now
              requiring trial_end > now. */}
          {!hasActiveStripe && !isCancelled && !isTrialing && (
            <>
              {isTrialExpired ? (
                <p className="text-sm text-ink-700 leading-relaxed">
                  Your trial has ended. Add a payment method to continue using
                  Longrein — you'll be charged immediately and can cancel any
                  time from this page.
                </p>
              ) : (
                <p className="text-sm text-ink-700 leading-relaxed">
                  Start your 14-day free trial. A card is required at signup —
                  you won't be charged until day 14, and you can cancel any
                  time in one click before then.
                </p>
              )}
              <div className="rounded-xl border border-ink-200 bg-white p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-ink-900">Longrein</p>
                  <p className="text-base font-semibold text-ink-900 tracking-tightest">€49 / month</p>
                </div>
                <p className="text-[13px] text-ink-500 mt-1 leading-relaxed">
                  Every feature included. Cancel anytime.
                </p>
              </div>
              <BillingActions
                kind="start"
                label={isTrialExpired ? "Continue to payment" : undefined}
                immediateCharge={isTrialExpired}
              />
            </>
          )}

          {isTrialing && (
            <>
              <p className="text-sm text-ink-700 leading-relaxed">
                You're on your 14-day free trial.
                {trialEndDate && (
                  <>
                    {" "}First charge: <strong>{trialEndDate}</strong>
                    {daysLeft !== null && <> ({daysLeft} {daysLeft === 1 ? "day" : "days"} from now)</>}.
                  </>
                )}
              </p>
              <p className="text-sm text-ink-500 leading-relaxed">
                Cancel any time before then in one click — you won't be charged.
              </p>
              <BillingActions kind="manage" />
            </>
          )}

          {isActive && (
            <>
              <p className="text-sm text-ink-700 leading-relaxed">
                Longrein — €49 / month. Renews automatically.
              </p>
              {subscription?.current_period_end && (
                <p className="text-[13px] text-ink-500">
                  Next renewal:{" "}
                  {new Date(subscription.current_period_end).toLocaleDateString("en-GB", {
                    day: "2-digit", month: "short", year: "numeric",
                  })}
                </p>
              )}
              <BillingActions kind="manage" />
            </>
          )}

          {isPastDue && (
            <>
              <p className="text-sm text-ink-700 leading-relaxed">
                Your last payment didn't go through. Update your card to keep
                your stable active — we'll retry automatically.
              </p>
              <BillingActions kind="manage" />
            </>
          )}

          {isCancelled && (
            <>
              <p className="text-sm text-ink-700 leading-relaxed">
                Your subscription is cancelled. Your data is preserved — reactivate
                any time to pick up where you left off.
              </p>
              <BillingActions kind="start" label="Reactivate" />
            </>
          )}
        </div>
      </Card>

      <Card padded={false}>
        <CardHeader
          title="Invoices &amp; receipts"
          subtitle="Manage cards, download invoices, view billing history."
        />
        <div className="p-6 flex flex-col gap-3">
          <p className="text-sm text-ink-500">
            All invoices and payment history live in the Stripe billing portal.
            Click "Manage subscription" above to access them.
          </p>
        </div>
      </Card>

      <Card padded={false}>
        <CardHeader
          title="Founding Members"
          subtitle="For the first 15 stables."
        />
        <div className="p-6 flex flex-col gap-3 text-sm text-ink-700 leading-relaxed">
          <p>
            Founding Members pay <strong>€25 per month, locked for life</strong> after a
            one-time <strong>€299 onboarding</strong> with the founder — 12 months
            free before the first charge.
          </p>
          <p className="text-ink-500">
            Founding Member onboarding is handled personally — not through this
            page. Reply to your welcome email or write to{" "}
            <a className="text-brand-700 underline" href="mailto:hello@longrein.eu">
              hello@longrein.eu
            </a>{" "}
            to ask about a seat.
          </p>
        </div>
      </Card>
    </div>
  );
}
