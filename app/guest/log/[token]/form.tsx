"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  submitGuestHealthEventAction,
  type GuestSubmitState,
} from "./actions";

// "use server" files cannot export runtime consts in Next 14.
const initialGuestSubmitState: GuestSubmitState = { error: null, success: false };

export function GuestLogForm({ token, kindLabel }: { token: string; kindLabel: string }) {
  // useFormState supports curried actions when the curry is server-side.
  const boundAction = submitGuestHealthEventAction.bind(null, token);
  const [state, formAction] = useFormState<GuestSubmitState, FormData>(
    boundAction,
    initialGuestSubmitState,
  );

  if (state.success) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
        <p className="text-emerald-900 font-semibold">Logged.</p>
        <p className="text-sm text-emerald-800 mt-1.5">
          The stable team can see your entry now. You can close this page.
        </p>
        <a
          href={`/guest/log/${token}`}
          className="inline-block mt-4 text-xs text-emerald-700 underline"
        >
          Log another visit
        </a>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink-800">What did you do?</span>
        <input
          type="text"
          name="title"
          required
          maxLength={200}
          placeholder={kindLabel === "vet visit" ? "e.g. Annual EHV-1 booster" : "e.g. New shoes — front + back"}
          className="border border-ink-200 rounded-md px-3 py-2.5 text-sm"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-800">Date</span>
          <input
            type="date"
            name="occurred_on"
            required
            defaultValue={today}
            max={today}
            className="border border-ink-200 rounded-md px-3 py-2.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-800">Next due (optional)</span>
          <input
            type="date"
            name="next_due_on"
            min={today}
            className="border border-ink-200 rounded-md px-3 py-2.5 text-sm"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink-800">Notes (optional)</span>
        <textarea
          name="notes"
          rows={3}
          maxLength={2000}
          placeholder="Anything the stable should know — observations, follow-up advice, products used."
          className="border border-ink-200 rounded-md px-3 py-2.5 text-sm"
        />
      </label>

      <Submit />

      {state.error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {state.error}
        </p>
      )}
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-stretch rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? "Saving…" : "Save to stable's log"}
    </button>
  );
}
