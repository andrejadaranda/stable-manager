// Personal account signup — €9/€15 B2C, for private horse owners
// who don't run a stable. They get a trimmed app: their own horses,
// calendar, sessions, expenses — no clients, no invitations, no
// payment collection.

import Link from "next/link";
import { SignupPersonalForm } from "@/components/auth/signup-personal-form";

export default function SignupPersonalPage() {
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tightest text-ink-900">
          Personal account
        </h1>
        <p className="text-sm text-ink-500 mt-1">
          For private horse owners managing their own horses. Calendar,
          sessions, expenses, vet records — all in one place.
        </p>
      </header>

      <div className="flex flex-col sm:flex-row gap-3">
        <PlanCard
          tier="mini"
          price="€9 / month"
          cap="Up to 2 horses"
          features={[
            "Personal calendar + sessions",
            "Health records + vet visits",
            "Expense + receipts tracking",
            "Photo album + private notes",
          ]}
        />
        <PlanCard
          tier="plus"
          price="€15 / month"
          cap="Up to 5 horses"
          features={[
            "Everything in Mini",
            "Per-horse goals + plans",
            "Annual PDF year-in-review",
            "Priority support",
          ]}
          recommended
        />
      </div>

      <SignupPersonalForm />

      <p className="text-sm text-ink-600 pt-5 border-t border-ink-100">
        Running a stable instead?{" "}
        <Link href="/signup/owner" className="font-medium text-brand-700 hover:text-brand-800">
          Create a stable →
        </Link>
      </p>
      <p className="text-sm text-ink-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
          Sign in →
        </Link>
      </p>
    </div>
  );
}

function PlanCard({
  tier,
  price,
  cap,
  features,
  recommended,
}: {
  tier:        "mini" | "plus";
  price:       string;
  cap:         string;
  features:    string[];
  recommended?: boolean;
}) {
  return (
    <div
      className={`
        flex-1 rounded-2xl border px-4 py-4 relative
        ${recommended
          ? "border-brand-300 bg-brand-50/60"
          : "border-ink-200 bg-white"}
      `}
    >
      {recommended && (
        <span className="absolute -top-2 right-3 text-[10px] uppercase tracking-wider font-semibold bg-brand-600 text-white px-2 py-0.5 rounded">
          Recommended
        </span>
      )}
      <p className="text-[11px] uppercase tracking-wider font-semibold text-ink-500">
        {tier === "mini" ? "Mini" : "Plus"}
      </p>
      <p className="text-2xl font-display text-ink-900 mt-1">{price}</p>
      <p className="text-[12.5px] text-ink-600 mt-0.5">{cap}</p>
      <ul className="text-[12px] text-ink-700 mt-3 space-y-1.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-1.5">
            <span aria-hidden className="text-emerald-600 mt-0.5">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
