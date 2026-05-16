// Renders auth-flow failures (expired confirmation link, code exchange failed,
// missing metadata, etc.). Always reachable — never gated by middleware — so
// the user can read the actual reason and recover instead of seeing a blank
// dashboard redirect.

import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  const reason = searchParams.reason ?? "Unknown error.";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-7">
      <div className="w-full max-w-md card-elevated p-7 md:p-8">
        <h1 className="text-xl font-semibold tracking-tightest text-ink-900">
          Couldn&apos;t finish sign-in
        </h1>
        <p className="text-sm text-ink-600 mt-2">
          The confirmation link did not work. This usually means it expired,
          was already used, or was clicked from a different browser than the
          one you signed up with.
        </p>

        <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          {reason}
        </div>

        <div className="mt-6 flex flex-col gap-2.5 text-sm">
          <Link
            href="/login"
            className="font-medium text-brand-700 hover:text-brand-800"
          >
            ← Back to sign in
          </Link>
          <Link
            href="/signup"
            className="font-medium text-brand-700 hover:text-brand-800"
          >
            Create a new account →
          </Link>
        </div>
      </div>
    </main>
  );
}
