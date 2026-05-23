// Post-submit confirmation page. We deliberately don't echo what was
// submitted (no PII bouncing back via URL) — just confirm receipt and
// tell the applicant what happens next.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicStableBySlug } from "@/services/joinRequests";

export const dynamic = "force-dynamic";

export default async function JoinSentPage({
  params,
}: {
  params: { slug: string };
}) {
  const stable = await getPublicStableBySlug(params.slug).catch(() => null);
  if (!stable) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start gap-2">
        <span
          aria-hidden
          className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 inline-flex items-center justify-center text-lg"
        >
          ✓
        </span>
        <h1 className="text-xl font-semibold tracking-tightest text-ink-900">
          Application sent
        </h1>
        <p className="text-sm text-ink-500">
          {stable.name} will review your request. When approved you'll get an
          email with a secure link to set your password and sign in.
        </p>
      </div>

      <div className="rounded-xl bg-ink-50/60 px-4 py-3 text-[12.5px] text-ink-600">
        <p className="font-medium text-ink-700">No email yet?</p>
        <p className="mt-1">
          Approval usually happens within a day. Check your spam folder if you
          haven't heard back in 48 hours.
        </p>
      </div>

      <p className="text-sm text-ink-600 pt-5 border-t border-ink-100">
        Already signed up?{" "}
        <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
          Sign in →
        </Link>
      </p>
    </div>
  );
}
