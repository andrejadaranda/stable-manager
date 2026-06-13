"use client";

import { useFormState, useFormStatus } from "react-dom";
import { submitGuestRideAction, type GuestRideState } from "./actions";

const initial: GuestRideState = { error: null, success: false };

export function GuestRideForm({ token, horseName }: { token: string; horseName: string }) {
  const boundAction = submitGuestRideAction.bind(null, token);
  const [state, formAction] = useFormState<GuestRideState, FormData>(boundAction, initial);

  if (state.success) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
        <p className="text-emerald-900 font-semibold">Ride logged.</p>
        <p className="text-sm text-emerald-800 mt-1.5">
          It&apos;s now on {horseName}&apos;s record. You can close this page.
        </p>
        <a href={`/guest/ride/${token}`} className="inline-block mt-4 text-xs text-emerald-700 underline">
          Log another ride
        </a>
      </div>
    );
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const hhmm = now.toTimeString().slice(0, 5);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-800">Date</span>
          <input type="date" name="date" required defaultValue={today} max={today}
            className="border border-ink-200 rounded-md px-3 py-2.5 text-sm" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-800">Time</span>
          <input type="time" name="time" required step={300} defaultValue={hhmm}
            className="border border-ink-200 rounded-md px-3 py-2.5 text-sm" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-800">Duration (min)</span>
          <input type="number" name="duration" required min={1} max={600} defaultValue={45}
            className="border border-ink-200 rounded-md px-3 py-2.5 text-sm" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-800">Type</span>
          <select name="type" defaultValue="flat"
            className="border border-ink-200 rounded-md px-3 py-2.5 text-sm bg-white">
            <option value="flat">Flat</option>
            <option value="jumping">Jumping</option>
            <option value="dressage">Dressage</option>
            <option value="hack">Hack</option>
            <option value="lunge">Lunge</option>
            <option value="other">Other</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink-800">How did it go? (optional)</span>
        <select name="rating" defaultValue=""
          className="border border-ink-200 rounded-md px-3 py-2.5 text-sm bg-white">
          <option value="">No rating</option>
          <option value="5">★★★★★ Excellent</option>
          <option value="4">★★★★ Good</option>
          <option value="3">★★★ OK</option>
          <option value="2">★★ Tough</option>
          <option value="1">★ Difficult</option>
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink-800">Notes (optional)</span>
        <textarea name="notes" rows={3} maxLength={2000}
          placeholder="Anything the owner should know — how the horse felt, what you worked on."
          className="border border-ink-200 rounded-md px-3 py-2.5 text-sm" />
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
      {pending ? "Saving…" : "Log the ride"}
    </button>
  );
}
