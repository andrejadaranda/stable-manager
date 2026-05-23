"use client";

// "Request a lesson" sheet for clients.
// Reused on /dashboard/my-lessons and /dashboard/my-horses/[id]
// (latter pre-fills the horse). Owner sees the request in
// /dashboard/lesson-requests and accepts/declines via RPC.

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  submitLessonRequestAction,
  type LessonRequestActionState,
} from "@/app/dashboard/my-lessons/request-actions";

const initial: LessonRequestActionState = { error: null, success: false };

export type HorseChoice = { id: string; name: string };

export function RequestLessonButton({
  horses,
  presetHorseId,
  variant = "primary",
  label = "+ Request a lesson",
}: {
  horses:          HorseChoice[];
  presetHorseId?:  string;
  variant?:        "primary" | "outline";
  label?:          string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === "primary"
            ? "h-10 px-4 rounded-xl text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors"
            : "h-9 px-3.5 rounded-xl text-sm font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 transition-colors"
        }
      >
        {label}
      </button>
      {open && (
        <Dialog
          horses={horses}
          presetHorseId={presetHorseId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function Dialog({
  horses,
  presetHorseId,
  onClose,
}: {
  horses:        HorseChoice[];
  presetHorseId?: string;
  onClose:       () => void;
}) {
  const [state, formAction] = useFormState<LessonRequestActionState, FormData>(
    submitLessonRequestAction,
    initial,
  );

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  // Sensible default: tomorrow at 17:00
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().slice(0, 10);

  return (
    <form
      action={formAction}
      className="fixed inset-0 z-30 flex items-stretch sm:items-start sm:justify-center sm:pt-16 bg-black/40 backdrop-blur-sm"
    >
      <div
        className="
          bg-white border border-neutral-200 flex flex-col w-full
          h-[100dvh] sm:h-auto sm:max-h-[calc(100dvh-5rem)]
          sm:rounded-xl sm:shadow-xl sm:max-w-md
        "
      >
        <div className="flex items-center justify-between px-5 sm:px-6 pt-5 sm:pt-6 pb-3 border-b border-neutral-100 sm:border-0 shrink-0">
          <h2 className="text-lg font-semibold">Request a lesson</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-neutral-500 hover:text-neutral-900 px-2 py-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-700 font-medium">Date</span>
              <input
                type="date"
                name="date"
                required
                defaultValue={defaultDate}
                className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-700 font-medium">Time</span>
              <input
                type="time"
                name="time"
                required
                defaultValue="17:00"
                step={900}
                className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-700 font-medium">Duration</span>
            <select
              name="duration"
              defaultValue="60"
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">60 min</option>
              <option value="75">75 min</option>
              <option value="90">90 min</option>
              <option value="120">2 hours</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-700 font-medium">
              Horse <span className="text-neutral-400 font-normal">(optional — stable can assign)</span>
            </span>
            <select
              name="horse_id"
              defaultValue={presetHorseId ?? ""}
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="">No preference — stable picks</option>
              {horses.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-700 font-medium">Notes for the stable</span>
            <textarea
              name="notes"
              rows={3}
              placeholder="e.g. preferred trainer Lina if possible, focus on canter transitions…"
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
            />
            <span className="text-[11px] text-neutral-500">
              The stable will confirm with a specific time, horse, and trainer.
            </span>
          </label>

          {state.error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {state.error}
            </p>
          )}
        </div>

        <div
          className="
            shrink-0 border-t border-neutral-100 sm:border-0
            px-5 sm:px-6 py-3 sm:py-2 sm:pb-6
            pb-[max(0.75rem,env(safe-area-inset-bottom))]
          "
        >
          <Submit />
        </div>
      </div>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full sm:w-auto rounded-md bg-neutral-900 text-white py-3 sm:py-2.5 px-4 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Sending…" : "Send request"}
    </button>
  );
}
