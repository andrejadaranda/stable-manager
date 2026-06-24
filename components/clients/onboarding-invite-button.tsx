"use client";

// "Send onboarding invitation" button for the client profile.
//
// Phase 1 of the TJK digital onboarding flow. One button, sent once — the
// hard guarantee lives in the server (atomic conditional UPDATE); this UI
// just reflects state and prevents the obvious double-click.
//
// States:
//   not_invited            -> active "Send onboarding invitation"
//   invited/opened/...     -> disabled "Onboarding invitation sent" + when/to
// Errors (no email, bad email, send failed) render inline so the owner
// knows exactly what to fix.

import { useFormState, useFormStatus } from "react-dom";
import {
  sendOnboardingInvitationAction,
  type OnboardingActionState,
} from "@/app/dashboard/clients/actions";
import type { OnboardingStatus } from "@/services/clients";

const initial: OnboardingActionState = { error: null, success: false };

/** Deterministic YYYY-MM-DD (no locale/timezone — avoids SSR hydration drift). */
function isoDate(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

export function OnboardingInviteButton({
  clientId,
  status,
  sentAt,
  sentTo,
}: {
  clientId: string;
  status: OnboardingStatus;
  sentAt: string | null;
  sentTo: string | null;
}) {
  const [state, formAction] = useFormState(sendOnboardingInvitationAction, initial);

  // Already sent (any status past not_invited) — show the locked state.
  // After a successful send the server revalidates the page, so `status`
  // arrives as 'invited' on the next render and we land here too.
  const alreadySent = status !== "not_invited" || state.success;
  if (alreadySent) {
    const when = isoDate(state.sentAt ?? sentAt);
    const to = state.sentTo ?? sentTo;
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] font-medium bg-ink-100 text-ink-500 cursor-not-allowed"
        >
          ✓ Onboarding invitation sent
        </button>
        {when && (
          <p className="text-[11.5px] text-ink-500">
            Sent on {when}{to ? ` to ${to}` : ""}.
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="client_id" value={clientId} />
      <SubmitButton />
      {state.error && (
        <p className="text-[11.5px] text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-2.5 py-1.5 leading-snug">
          {state.error}
        </p>
      )}
      {!state.error && (
        <p className="text-[11.5px] text-ink-500">
          Sends the first-lesson email with a secure link. Sent once.
        </p>
      )}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] font-medium bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? "Sending…" : "Send onboarding invitation"}
    </button>
  );
}
