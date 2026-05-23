"use client";

// Public form for applying to join an existing stable.
// Submits to /signup/join/[slug]/actions.ts; redirects to /sent on success.

import { useFormState, useFormStatus } from "react-dom";
import {
  submitJoinAction,
  type JoinSubmitState,
} from "@/app/(auth)/signup/join/[slug]/actions";

const initial: JoinSubmitState = { error: null, success: false };

export function JoinStableForm({
  stableSlug,
  stableName,
}: {
  stableSlug: string;
  stableName: string;
}) {
  const [state, formAction] = useFormState(submitJoinAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={stableSlug} />

      <fieldset className="border border-ink-200 rounded-xl px-4 py-3">
        <legend className="text-[11px] uppercase tracking-wider font-semibold text-ink-500 px-1">
          I'm joining as
        </legend>
        <div className="flex flex-col gap-2 mt-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="radio" name="role" value="rider" defaultChecked className="mt-1" />
            <div>
              <p className="text-sm font-medium text-ink-900">Rider</p>
              <p className="text-[12px] text-ink-500">
                I take lessons at {stableName} on stable-owned horses.
              </p>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="radio" name="role" value="horse_owner" className="mt-1" />
            <div>
              <p className="text-sm font-medium text-ink-900">Horse owner</p>
              <p className="text-[12px] text-ink-500">
                I board my own horse at {stableName}.
              </p>
            </div>
          </label>
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-neutral-700 font-medium">Full name</span>
        <input
          type="text"
          name="full_name"
          required
          minLength={2}
          maxLength={80}
          autoComplete="name"
          className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-neutral-700 font-medium">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-neutral-700 font-medium">
          Phone <span className="text-neutral-400 font-normal">(optional)</span>
        </span>
        <input
          type="tel"
          name="phone"
          autoComplete="tel"
          placeholder="+370…"
          className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-neutral-700 font-medium">
          Message <span className="text-neutral-400 font-normal">(optional)</span>
        </span>
        <textarea
          name="message"
          rows={3}
          placeholder={`Hi, I'd like to start riding at ${stableName}. I have …`}
          className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
        />
        <span className="text-[11px] text-neutral-500">
          The stable owner sees this with your application.
        </span>
      </label>

      {state.error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {state.error}
        </p>
      )}

      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-brand-600 text-white py-3 px-4 text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Sending…" : "Send application"}
    </button>
  );
}
