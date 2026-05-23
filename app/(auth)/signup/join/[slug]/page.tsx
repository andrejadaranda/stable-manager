// Apply to a specific stable. Slug pre-fills the stable, the form
// captures role + contact + optional message. Submission lands in
// stable_join_requests with status='pending' for the owner to review.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicStableBySlug } from "@/services/joinRequests";
import { JoinStableForm } from "@/components/auth/join-stable-form";

export const dynamic = "force-dynamic";

export default async function JoinStablePage({
  params,
}: {
  params: { slug: string };
}) {
  const stable = await getPublicStableBySlug(params.slug).catch(() => null);
  if (!stable) notFound();

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tightest text-ink-900">
          Apply to {stable.name}
        </h1>
        <p className="text-sm text-ink-500 mt-1">
          The stable owner will review your application and send you an email
          link to set your password.
        </p>
      </header>

      {!stable.accepts_public_join && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          This stable isn't accepting public applications right now. Ask the
          stable directly for a personal invitation link.
        </p>
      )}

      {stable.accepts_public_join && (
        <JoinStableForm stableSlug={stable.slug} stableName={stable.name} />
      )}

      <p className="text-sm text-ink-600 pt-5 border-t border-ink-100">
        <Link href="/signup/join" className="font-medium text-brand-700 hover:text-brand-800">
          ← Pick a different stable
        </Link>
      </p>
    </div>
  );
}
