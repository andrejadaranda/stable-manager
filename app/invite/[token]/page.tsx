// =============================================================
// Public invite-accept page.
//
// The client clicks the link in their email and lands here. We
// validate the token server-side (no client-side fetch) and either
// render the password-set form or a clear "this link is no longer
// valid" message.
//
// Reachable WITHOUT auth — middleware doesn't gate /invite/*.
// =============================================================

import Link from "next/link";
import { lookupInviteByToken } from "@/services/invitations";
import { AcceptInviteForm } from "./accept-form";

export const dynamic = "force-dynamic";  // never cache — token is unique per link

export default async function InviteAcceptPage({
  params,
}: {
  params: { token: string };
}) {
  const invite = await lookupInviteByToken(params.token).catch(() => null);

  if (!invite) {
    return (
      <InvitePageShell>
        <h1 className="text-xl font-semibold text-neutral-900">
          Link no longer valid
        </h1>
        <p className="mt-3 text-sm text-neutral-600">
          This invitation link has expired, was revoked, or was already used.
          Ask your trainer to send you a new one.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-emerald-700 hover:underline"
        >
          Sign in instead →
        </Link>
      </InvitePageShell>
    );
  }

  return (
    <InvitePageShell>
      <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-neutral-500">
        {invite.stable_name} · Client portal
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-neutral-900">
        Welcome, {invite.client_name}.
      </h1>
      <p className="mt-3 text-sm text-neutral-600">
        Set a password to finish setting up your account. You&apos;ll sign in
        with <span className="font-medium text-neutral-800">{invite.email}</span>.
      </p>

      <div className="mt-6">
        <AcceptInviteForm token={params.token} email={invite.email} />
      </div>

      <p className="mt-6 text-xs text-neutral-500">
        Invitation expires {new Date(invite.expires_at).toLocaleDateString("en-GB", {
          day: "2-digit", month: "short", year: "numeric",
        })}.
      </p>
    </InvitePageShell>
  );
}

function InvitePageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-start justify-center px-4 py-16">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-neutral-200 p-8">
        {children}
      </div>
    </div>
  );
}
