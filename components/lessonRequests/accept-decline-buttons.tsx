"use client";

// Owner / employee Accept + Decline sheets for a single lesson_request.
// Accept opens a sheet that pre-fills the requested values and lets the
// owner override horse / trainer / time / duration / price before
// confirming (which calls the SECURITY DEFINER RPC to create the real
// lesson). Decline is a lighter sheet with optional reason.

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  acceptLessonRequestAction,
  declineLessonRequestAction,
  type LessonRequestResponseState,
} from "@/app/dashboard/lesson-requests/actions";

const initial: LessonRequestResponseState = { error: null, success: false };

export type HorseOpt   = { id: string; name: string };
export type TrainerOpt = { id: string; full_name: string };

export function RespondLessonRequestButtons({
  requestId,
  requestedStart,
  requestedDurationMin,
  presetHorseId,
  presetTrainerId,
  horses,
  trainers,
}: {
  requestId:            string;
  requestedStart:       string;          // ISO
  requestedDurationMin: number;
  presetHorseId?:       string | null;
  presetTrainerId?:     string | null;
  horses:               HorseOpt[];
  trainers:             TrainerOpt[];
}) {
  const [open, setOpen] = useState<null | "accept" | "decline">(null);

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen("accept")}
          className="h-8 px-3 rounded-lg text-[12px] font-medium bg-emerald-600 text-white hover:bg-emerald-700"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={() => setOpen("decline")}
          className="h-8 px-3 rounded-lg text-[12px] font-medium bg-white border border-ink-200 text-ink-700 hover:bg-ink-50"
        >
          Decline
        </button>
      </div>

      {open === "accept" && (
        <AcceptDialog
          requestId={requestId}
          requestedStart={requestedStart}
          requestedDurationMin={requestedDurationMin}
          presetHorseId={presetHorseId}
          presetTrainerId={presetTrainerId}
          horses={horses}
          trainers={trainers}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "decline" && (
        <DeclineDialog
          requestId={requestId}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

function AcceptDialog({
  requestId,
  requestedStart,
  requestedDurationMin,
  presetHorseId,
  presetTrainerId,
  horses,
  trainers,
  onClose,
}: {
  requestId:            string;
  requestedStart:       string;
  requestedDurationMin: number;
  presetHorseId?:       string | null;
  presetTrainerId?:     string | null;
  horses:               HorseOpt[];
  trainers:             TrainerOpt[];
  onClose:              () => void;
}) {
  const [state, formAction] = useFormState<LessonRequestResponseState, FormData>(
    acceptLessonRequestAction,
    initial,
  );

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  const defaultDate = requestedStart.slice(0, 10);
  const defaultTime = requestedStart.slice(11, 16);

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
          <h2 className="text-lg font-semibold">Accept and schedule</h2>
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
          <input type="hidden" name="request_id" value={requestId} />

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
                step={900}
                defaultValue={defaultTime}
                className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-700 font-medium">Duration</span>
            <select
              name="duration"
              defaultValue={String(requestedDurationMin)}
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
            >
              {[30, 45, 60, 75, 90, 120].map((m) => (
                <option key={m} value={m}>{m} min</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-700 font-medium">Horse</span>
            <select
              name="horse_id"
              required
              defaultValue={presetHorseId ?? ""}
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="" disabled>Pick a horse</option>
              {horses.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-700 font-medium">Trainer</span>
            <select
              name="trainer_id"
              required
              defaultValue={presetTrainerId ?? ""}
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="" disabled>Pick a trainer</option>
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-700 font-medium">Price (€)</span>
            <input
              type="number"
              name="price"
              min="0"
              step="0.50"
              defaultValue="0"
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
            />
            <span className="text-[11px] text-neutral-500">
              Set 0 if this is part of a package — you can edit later from the calendar.
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
          <Submit label="Schedule lesson" pendingLabel="Scheduling…" tone="emerald" />
        </div>
      </div>
    </form>
  );
}

function DeclineDialog({
  requestId,
  onClose,
}: {
  requestId: string;
  onClose:   () => void;
}) {
  const [state, formAction] = useFormState<LessonRequestResponseState, FormData>(
    declineLessonRequestAction,
    initial,
  );

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

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
          <h2 className="text-lg font-semibold">Decline request</h2>
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
          <input type="hidden" name="request_id" value={requestId} />

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-700 font-medium">
              Reason <span className="text-neutral-400 font-normal">(optional, shared with client)</span>
            </span>
            <textarea
              name="reason"
              rows={3}
              placeholder="e.g. The trainer is fully booked that day — try Wednesday afternoon?"
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
            />
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
          <Submit label="Send decline" pendingLabel="Sending…" tone="neutral" />
        </div>
      </div>
    </form>
  );
}

function Submit({
  label,
  pendingLabel,
  tone,
}: {
  label: string;
  pendingLabel: string;
  tone: "emerald" | "neutral";
}) {
  const { pending } = useFormStatus();
  const cls =
    tone === "emerald"
      ? "bg-emerald-600 hover:bg-emerald-700"
      : "bg-neutral-900 hover:bg-neutral-800";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`w-full sm:w-auto rounded-md text-white py-3 sm:py-2.5 px-4 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${cls}`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
