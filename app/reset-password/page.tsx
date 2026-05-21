// Password-recovery completion page.
// User lands here from the Supabase recovery email link with a session
// that's only authorised to update the password. The middleware allows
// this route through (it's not under /dashboard).
//
// Layout-wise we mimic the (auth) group's centred card without depending
// on that group's layout, since this route lives outside that segment to
// keep its URL simple and bookmark-friendly.

import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-surface flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-soft p-7">
        <div className="mb-5">
          <Link
            href="/login"
            className="font-serif text-xl font-semibold tracking-tightest text-brand-700"
          >
            Longrein<span className="text-saddle-500">.</span>
          </Link>
        </div>

        <ResetPasswordForm />

        <p className="text-sm text-ink-600 mt-6 pt-5 border-t border-ink-100">
          Need help?{" "}
          <a className="font-medium text-brand-700 hover:text-brand-800" href="mailto:hello@longrein.eu">
            hello@longrein.eu
          </a>
        </p>
      </div>
    </main>
  );
}
