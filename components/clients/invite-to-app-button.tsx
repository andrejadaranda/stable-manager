"use client";

import { useState, useTransition } from "react";
import { sendInviteAction, type InviteActionState } from "@/app/dashboard/clients/invite-actions";

type Props = {
  clientId: string;
  /** True when the client is already linked to a portal account in
   *  THIS stable. We hide the button entirely. */
  hasPortalAccount: boolean;
  /** True when the client's email/phone already belongs to a Longrein
   *  auth.user / profile ANY stable. We hide the button entirely —
   *  inviting would just 500 on createUser, or surprise the person
   *  with a cross-stable link. */
  hasLongreinAccount?: boolean;
  /** True when there's an in-flight (unused, unexpired, unrevoked) invite.
   *  We surface "Resend invite" instead of "Invite to app" — and the click
   *  re-emits to the same email (revokes the old link, mints a new one). */
  hasPendingInvite: boolean;
  /** Used for the "no email" guard so we can show a friendly error
   *  instead of bouncing to the server. */
  hasEmail: boolean;
  /** Compact variant for the client list rows. Defaults false (used
   *  in client detail header). */
  compact?: boolean;
};

/**
 * One-click invite trigger. Owner-only — render conditionally.
 *
 * Three visual states:
 *   1. "Invite to app"   — no invite, has email
 *   2. "Resend invite"   — pending invite (yellow tint), click to re-emit
 *   3. nothing rendered  — client already linked (hasPortalAccount)
 *
 * Errors render inline as a tiny pill below the row, so we don't
 * displace the whole list layout when something goes wrong.
 */
export function InviteToAppButton({
  clientId,
  hasPortalAccount,
  hasLongreinAccount = false,
  hasPendingInvite,
  hasEmail,
  compact = false,
}: Props) {
  const [pending, startTransition]    = useTransition();
  const [result, setResult]           = useState<InviteActionState | null>(null);
  const [copyStatus, setCopyStatus]   = useState<"idle" | "copied">("idle");

  // Same-stable link OR any-stable account → no invite button. The
  // tiny "Has account" pill explains why for the cross-stable case
  // (vs same-stable link which is implicit because they show up as
  // already-linked elsewhere in the UI).
  if (hasPortalAccount) return null;
  if (hasLongreinAccount) {
    const pillStyle = compact
      ? "text-[10px] px-1.5 py-0.5"
      : "text-xs px-2 py-1";
    return (
      <span
        className={`${pillStyle} rounded border border-neutral-200 bg-neutral-50 text-neutral-500 whitespace-nowrap`}
        title="This person's email or phone already has a Longrein account."
      >
        Has account
      </span>
    );
  }

  function sendInvite() {
    if (!hasEmail) {
      setResult({
        error:   "Add an email to the client first.",
        link:    null,
        emailed: false,
      });
      return;
    }
    const fd = new FormData();
    fd.set("client_id", clientId);
    startTransition(async () => {
      const r = await sendInviteAction(
        { error: null, link: null, emailed: false },
        fd,
      );
      setResult(r);
    });
  }

  async function copyLink() {
    if (!result?.link) return;
    try {
      await navigator.clipboard.writeText(result.link);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1500);
    } catch {
      // Clipboard API can fail in some embedded contexts — fall back to
      // a manual prompt the user can copy from.
      window.prompt("Copy this invite link:", result.link);
    }
  }

  // Compact button (client list row)
  const baseStyle = compact
    ? "text-xs font-medium px-2 py-1 rounded border whitespace-nowrap"
    : "text-sm font-medium px-3 py-2 rounded-md border whitespace-nowrap";

  const colorStyle = hasPendingInvite
    ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
    : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();   // suppress parent <Link> navigation
          sendInvite();
        }}
        disabled={pending}
        className={`${baseStyle} ${colorStyle} disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {pending
          ? "Sending…"
          : hasPendingInvite
          ? "Resend invite"
          : "Invite to app"}
      </button>

      {result?.link && (
        <div className="flex items-center gap-1 text-[11px]">
          <span className={result.emailed ? "text-emerald-700" : "text-amber-700"}>
            {result.emailed ? "Email sent" : "Link ready (email failed)"}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              copyLink();
            }}
            className="px-1.5 py-0.5 rounded border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
          >
            {copyStatus === "copied" ? "Copied ✓" : "Copy link"}
          </button>
        </div>
      )}

      {result?.error && (
        <p className="text-[11px] text-red-700 max-w-[12rem] text-right">
          {result.error}
        </p>
      )}
    </div>
  );
}
