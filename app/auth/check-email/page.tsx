// Shown after a successful signup OR when the user tried to log in but
// hadn't confirmed yet. Explains what to do, supports resending the
// confirmation email, and surfaces obvious troubleshooting up front so we
// don't get "I never got an email" support tickets.

import Link from "next/link";
import { ResendConfirmationForm } from "@/components/auth/resend-confirmation";

export const dynamic = "force-dynamic";

export default function CheckEmailPage({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  const email = searchParams.email ?? "";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-7">
      <div className="w-full max-w-md card-elevated p-7 md:p-8">
        <h1 className="text-xl font-semibold tracking-tightest text-ink-900">
          Check your email
        </h1>
        <p className="text-sm text-ink-600 mt-2">
          {email ? (
            <>
              We sent a confirmation link to <strong>{email}</strong>. Click
              the link in that email to activate your account and finish
              setting up your stable.
            </>
          ) : (
            <>
              We sent a confirmation link to your email. Click it to activate
              your account.
            </>
          )}
        </p>

        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] text-amber-900 space-y-1.5">
          <p className="font-medium">Didn&apos;t get it?</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Check your spam / junk folder.</li>
            <li>Wait 30–60 seconds — email can take a moment.</li>
            <li>Make sure your email address was correct.</li>
            <li>Use the resend button below.</li>
          </ul>
        </div>

        <div className="mt-6">
          <ResendConfirmationForm defaultEmail={email} />
        </div>

        <div className="mt-6 pt-5 border-t border-ink-100 text-sm">
          <Link
            href="/login"
            className="font-medium text-brand-700 hover:text-brand-800"
          >
            ← Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
