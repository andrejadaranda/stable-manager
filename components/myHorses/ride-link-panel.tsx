"use client";

// Owner-client tool: mint a magic link so someone (e.g. a rider you lend the
// horse to) can log a ride on YOUR horse without an account. No client list
// is exposed — you share the link directly with whoever you trust.

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  createRideLinkAction,
  revokeRideLinkAction,
  type RideLinkState,
} from "@/app/dashboard/my-horses/[id]/ride-link-actions";
import type { GuestContributorToken } from "@/services/guestContributors.pure";

const initial: RideLinkState = { error: null, url: null };

export function RideLinkPanel({
  horseId,
  horseName,
  links,
}: {
  horseId: string;
  horseName: string;
  links: GuestContributorToken[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(createRideLinkAction, initial);

  const active = links.filter((l) => !l.revoked_at && new Date(l.expires_at) > new Date());

  return (
    <section className="bg-white rounded-2xl shadow-soft p-5">
      <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
        <div>
          <h2 className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-500">
            Let someone ride {horseName}
          </h2>
          <p className="text-[12.5px] text-ink-500 mt-1">
            Share a private link so a rider can log their rides — no account needed.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-9 px-3 rounded-lg text-[12px] font-medium text-white bg-brand-600 hover:bg-brand-700"
          >
            Create ride link
          </button>
        )}
      </div>

      {open && (
        <form action={action} className="flex flex-col gap-2 mb-3">
          <input type="hidden" name="horse_id" value={horseId} />
          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-ink-600">Rider&apos;s name</span>
            <input
              type="text"
              name="rider_name"
              required
              maxLength={80}
              placeholder="e.g. Paula"
              className="rounded-lg border border-ink-200 px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
            />
          </label>
          {state.error && <p className="text-[12px] text-rose-600">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="text-[12px] text-ink-500 hover:text-ink-900 px-2 py-1">
              Cancel
            </button>
            <CreateButton />
          </div>
        </form>
      )}

      {state.url && (
        <div className="rounded-xl bg-brand-50 border border-brand-100 px-3 py-2.5 mb-3">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-brand-700 mb-1">
            Link ready — share it with your rider
          </p>
          <code className="block text-[11.5px] text-ink-800 break-all">{state.url}</code>
          <CopyButton text={state.url} />
        </div>
      )}

      {active.length > 0 && (
        <ul className="flex flex-col gap-2">
          {active.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 px-3 py-2">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink-900 truncate">{l.contributor_name}</p>
                <p className="text-[11px] text-ink-400">
                  {l.use_count} {l.use_count === 1 ? "ride" : "rides"} logged
                </p>
              </div>
              <RevokeButton tokenId={l.id} horseId={horseId} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CreateButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="text-[12px] text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-md font-medium disabled:opacity-50">
      {pending ? "Creating…" : "Create link"}
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked — user can select manually */
        }
      }}
      className="mt-2 text-[12px] text-brand-700 hover:text-brand-900 font-medium"
    >
      {copied ? "Copied ✓" : "Copy link"}
    </button>
  );
}

function RevokeButton({ tokenId, horseId }: { tokenId: string; horseId: string }) {
  const [, action] = useFormState(revokeRideLinkAction, initial);
  return (
    <form action={action}>
      <input type="hidden" name="token_id" value={tokenId} />
      <input type="hidden" name="horse_id" value={horseId} />
      <button type="submit" className="text-[11.5px] text-red-600 hover:text-red-800">
        Revoke
      </button>
    </form>
  );
}
