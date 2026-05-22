"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  createClientAction,
  type CreateClientState,
} from "@/app/dashboard/clients/actions";

const createClientInitialState: CreateClientState = { error: null, success: false };

export function CreateClientPanel() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm font-medium hover:bg-neutral-800"
      >
        {open ? "Close" : "+ New client"}
      </button>
      {open && <CreateClientForm onClose={() => setOpen(false)} />}
    </>
  );
}

function CreateClientForm({ onClose }: { onClose: () => void }) {
  const [state, formAction] = useFormState<CreateClientState, FormData>(
    createClientAction, createClientInitialState,
  );

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  return (
    <form
      action={formAction}
      // Mobile: full-screen sheet so the entire form (including Submit) is
      // always reachable above the iOS home indicator and the keyboard.
      // Desktop: centered modal as before.
      className="fixed inset-0 z-30 flex items-stretch sm:items-start sm:justify-center sm:pt-16 bg-black/40 backdrop-blur-sm"
    >
      <div
        className="
          bg-white border border-neutral-200 flex flex-col w-full
          h-[100dvh] sm:h-auto sm:max-h-[calc(100dvh-5rem)]
          sm:rounded-xl sm:shadow-xl sm:max-w-md
        "
      >
        {/* Header (sticky on mobile) */}
        <div className="flex items-center justify-between px-5 sm:px-6 pt-5 sm:pt-6 pb-3 border-b border-neutral-100 sm:border-0 shrink-0">
          <h2 className="text-lg font-semibold">New client</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-neutral-500 hover:text-neutral-900 px-2 py-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-3 flex flex-col gap-3.5">
          <Field label="Full name" name="full_name" type="text" required />
          <Field label="Phone (optional)" name="phone" type="tel" />
          <Field label="Email (optional)" name="email" type="email" />

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-700">Skill level</span>
            <select
              name="skill_level"
              defaultValue=""
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="">—</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="pro">Pro</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-700">Status</span>
            <select
              name="status"
              defaultValue="active"
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-700">Notes (optional)</span>
            <textarea
              name="notes"
              rows={2}
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
            />
          </label>

          {state.error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {state.error}
            </p>
          )}
        </div>

        {/* Sticky footer with Submit — always visible on mobile, safe-area aware */}
        <div
          className="
            shrink-0 border-t border-neutral-100 sm:border-0
            px-5 sm:px-6 py-3 sm:py-2 sm:pb-6
            pb-[max(0.75rem,env(safe-area-inset-bottom))]
          "
        >
          <Submit label="Create client" />
        </div>
      </div>
    </form>
  );
}

// ---------- primitives ----------
function Field(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label: string },
) {
  const { label, ...rest } = props;
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-neutral-700 font-medium">{label}</span>
      <input
        className="border border-neutral-300 rounded-md px-3 py-2 text-sm placeholder:text-neutral-400"
        {...rest}
      />
    </label>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full sm:w-auto rounded-md bg-neutral-900 text-white py-3 sm:py-2.5 px-4 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Creating…" : label}
    </button>
  );
}
