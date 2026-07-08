"use client";

// Danger zone — permanent account deletion (App Store guideline 5.1.1(v)).
// Two-step: expand → type DELETE → confirm. Owners see the strong warning
// that this removes the whole stable; staff/clients only lose their access.

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { deleteAccountAction, type DeleteAccountState } from "@/app/dashboard/settings/profile/delete-account-action";

const initial: DeleteAccountState = { error: null };

export function DeleteAccountSection({ isOwner }: { isOwner: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(deleteAccountAction, initial);

  return (
    <section className="bg-white rounded-2xl shadow-soft ring-1 ring-rose-200 p-5 md:p-6 flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-rose-800">Delete account</h2>
        <p className="text-[12.5px] text-ink-600 mt-1 leading-relaxed">
          {isOwner
            ? "Permanently deletes your account and your whole stable — horses, clients, lessons, payments and all records. This cannot be undone."
            : "Permanently deletes your account and removes your access to this stable. This cannot be undone."}
        </p>
      </div>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-10 px-4 w-fit rounded-xl text-sm font-medium text-rose-700 ring-1 ring-rose-300 hover:bg-rose-50 transition-colors"
        >
          Delete my account
        </button>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-[12.5px] text-ink-700">
              Type <span className="font-semibold text-rose-800">DELETE</span> to confirm.
            </span>
            <input
              name="confirm"
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="DELETE"
              className="rounded-xl border border-ink-200 bg-white text-sm px-3 py-2.5 max-w-[220px] focus:outline-none focus:ring-2 focus:ring-rose-400/40 focus:border-rose-400"
            />
          </label>
          {state.error && <p className="text-[12.5px] text-rose-700">{state.error}</p>}
          <div className="flex items-center gap-2">
            <DeleteSubmit />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-10 px-4 rounded-xl text-sm text-ink-700 hover:bg-ink-100/60"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function DeleteSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 px-4 rounded-xl text-sm font-medium bg-rose-700 text-white hover:bg-rose-800 disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Permanently delete"}
    </button>
  );
}
