// Public signup landing — three paths.
// 1. Owner — creates a new stable (existing flow at /signup/owner).
// 2. Join an existing stable — rider or horse-owner application.
// 3. Personal account (B2C) — shipping soon, gated CTA for now.
//
// The standalone owner form moved to /signup/owner so this landing
// page can lead with the role picker and avoid the existing single-
// page bias toward stable creation.

import Link from "next/link";

export default function SignupLandingPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tightest text-ink-900">
          Get started
        </h1>
        <p className="text-sm text-ink-500 mt-1">
          Pick the option that matches how you'll use Longrein.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <Card
          href="/signup/owner"
          title="I run a stable"
          body="Manage horses, lessons, clients, and payments in one place. €49/mo with a 14-day free trial — card required, cancel any time. Founding 15 spots at €25/mo for life: write to hello@longrein.eu."
          cta="Create a stable →"
          tone="primary"
        />
        <Card
          href="/signup/join"
          title="I'm joining an existing stable"
          body="Apply to your stable as a rider or horse owner. Free for riders. Stable owner reviews and approves your application."
          cta="Find your stable →"
          tone="secondary"
        />
        <Card
          href="/signup/personal"
          title="Personal account"
          body="For private horse owners without a stable. Log your own sessions, vet visits, expenses, and goals. €9/mo for up to 2 horses · €15/mo for up to 5."
          cta="Create personal account →"
          tone="secondary"
        />
      </div>

      <p className="text-sm text-ink-600 pt-5 border-t border-ink-100">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-brand-700 hover:text-brand-800"
        >
          Sign in →
        </Link>
      </p>
    </div>
  );
}

function Card({
  href,
  title,
  body,
  cta,
  tone,
  disabled,
}: {
  href:     string;
  title:    string;
  body:     string;
  cta:      string;
  tone:     "primary" | "secondary" | "muted";
  disabled?: boolean;
}) {
  const base =
    "block rounded-2xl border px-5 py-4 transition-colors text-left";
  const toneCls =
    tone === "primary"
      ? "border-brand-300 bg-brand-50/60 hover:bg-brand-50"
      : tone === "secondary"
      ? "border-ink-200 bg-white hover:bg-ink-50/60"
      : "border-ink-200 bg-ink-50/40 opacity-70 cursor-not-allowed";
  const ctaCls =
    tone === "primary"
      ? "text-brand-700 group-hover:text-brand-800"
      : tone === "secondary"
      ? "text-navy-900 group-hover:text-brand-700"
      : "text-ink-500";

  if (disabled) {
    return (
      <div className={`${base} ${toneCls}`}>
        <p className="font-semibold text-ink-900">{title}</p>
        <p className="text-[13px] text-ink-600 mt-1 leading-relaxed">{body}</p>
        <p className={`text-sm font-medium mt-3 ${ctaCls}`}>{cta}</p>
      </div>
    );
  }
  return (
    <Link href={href} className={`group ${base} ${toneCls}`}>
      <p className="font-semibold text-ink-900">{title}</p>
      <p className="text-[13px] text-ink-600 mt-1 leading-relaxed">{body}</p>
      <p className={`text-sm font-medium mt-3 ${ctaCls}`}>{cta}</p>
    </Link>
  );
}
