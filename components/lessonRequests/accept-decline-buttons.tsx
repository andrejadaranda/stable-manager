"use client";

// Owner / employee Accept + Decline sheets for a single lesson_request.
//
// Accept opens a sheet pre-filled with the client's requested values; the
// owner can override horse / trainer / time / duration / price before
// confirming, which calls the SECURITY DEFINER RPC to create the real
// lesson. Decline is a lighter sheet with an optional reason that gets
// shared back with the client.
//
// Both dialogs:
//   - render as a full-screen sheet on mobile, centered card on desktop
//   - close on ESC
//   - use the brand <Field>/<Input>/<Select>/<Textarea>/<Button>
//     primitives so styling stays consistent with the rest of the app

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  acceptLessonRequestAction,
  declineLessonRequestAction,
  type LessonRequestResponseState,
} from "@/app/dashboard/lesson-requests/actions";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";

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
          className="h-8 px-3 rounded-lg text-[12px] font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={() => setOpen("decline")}
          className="h-8 px-3 rounded-lg text-[12px] font-medium bg-white border border-ink-200 text-ink-700 hover:bg-ink-50 transition-colors"
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

// Shared sheet shell — full-screen on mobile, centered card on desktop.
// ESC closes. Click-outside intentionally NOT supported so an accidental
// backdrop tap can't wipe partially typed input.
function Sheet({
  title,
  subtitle,
  children,
  onClose,
  onSubmit,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-stretch sm:items-start sm:justify-center sm:pt-10 bg-ink-900/40 backdrop-blur-sm"
    >
      <form
        action={onSubmit}
        className="
          bg-white border border-ink-100 flex flex-col w-full
          h-[100dvh] sm:h-auto sm:max-h-[calc(100dvh-5rem)]
          sm:rounded-2xl sm:shadow-soft sm:max-w-md
        "
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-ink-100 shrink-0">
          <div>
            <h2 className="font-display text-xl text-navy-700 leading-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[12.5px] text-ink-500 mt-1 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-1 -mr-1 h-8 w-8 inline-flex items-center justify-center rounded-lg text-ink-500 hover:text-ink-900 hover:bg-ink-100/60 transition-colors"
          >
            <span aria-hidden className="text-base">✕</span>
          </button>
        </div>

        {children}
      </form>
    </div>
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

  // Convert UTC ISO from DB → Europe/Vilnius wall-clock for the inputs so
  // the owner sees "16:00" if the client wrote "16:00 Lithuania time" —
  // not whatever UTC offset the server stored it at.
  const vilniusISO = (() => {
    const d = new Date(requestedStart);
    const parts = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Vilnius",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return {
      date: `${get("year")}-${get("month")}-${get("day")}`,
      time: `${get("hour")}:${get("minute")}`,
    };
  })();
  const defaultDate = vilniusISO.date;
  const defaultTime = vilniusISO.time;

  return (
    <Sheet
      title="Accept and schedule"
      subtitle="Confirm the details — these become the real lesson on the calendar."
      onClose={onClose}
      onSubmit={formAction}
    >
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
        <input type="hidden" name="request_id" value={requestId} />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required>
            <Input
              type="date"
              name="date"
              required
              defaultValue={defaultDate}
            />
          </Field>
          <Field label="Time" required>
            <Input
              type="time"
              name="time"
              required
              step={900}
              defaultValue={defaultTime}
            />
          </Field>
        </div>

        <Field label="Duration">
          <Select name="duration" defaultValue={String(requestedDurationMin)}>
            {[30, 45, 60, 75, 90, 120].map((m) => (
              <option key={m} value={m}>{m} min</option>
            ))}
          </Select>
        </Field>

        <Field label="Horse" required>
          <Select name="horse_id" required defaultValue={presetHorseId ?? ""}>
            <option value="" disabled>Pick a horse</option>
            {horses.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </Select>
        </Field>

        <Field label="Trainer" required>
          <Select name="trainer_id" required defaultValue={presetTrainerId ?? ""}>
            <option value="" disabled>Pick a trainer</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>{t.full_name}</option>
            ))}
          </Select>
        </Field>

        <Field
          label="Price (€)"
          hint="Set 0 if this is part of a package — you can edit later from the calendar."
        >
          <Input
            type="number"
            name="price"
            min="0"
            step="0.50"
            defaultValue="0"
          />
        </Field>

        {state.error && (
          <p
            role="alert"
            className="text-[13px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3.5 py-2.5 leading-relaxed"
          >
            {state.error}
          </p>
        )}
      </div>

      <div
        className="
          shrink-0 border-t border-ink-100
          px-6 py-3 sm:py-4
          pb-[max(0.75rem,env(safe-area-inset-bottom))]
          flex items-center justify-end gap-2
        "
      >
        <Button type="button" variant="ghost" size="md" onClick={onClose}>
          Cancel
        </Button>
        <ScheduleSubmit />
      </div>
    </Sheet>
  );
}

function ScheduleSubmit() {
  const { pending } = useFormStatus();
  return (
    // Emerald instead of brand: green = "accept" in the lesson-request
    // context (mirrors the inline Accept button). Brand is reserved for
    // neutral primary actions across the app.
    <Button
      type="submit"
      size="md"
      loading={pending}
      className="bg-emerald-600 hover:bg-emerald-700"
    >
      {pending ? "Scheduling…" : "Schedule lesson"}
    </Button>
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
    <Sheet
      title="Decline request"
      subtitle="Send a brief reason so the client knows what to try next."
      onClose={onClose}
      onSubmit={formAction}
    >
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
        <input type="hidden" name="request_id" value={requestId} />

        <Field
          label="Reason"
          hint="Optional — shared with the client. E.g. 'Trainer is fully booked that day — try Wednesday afternoon?'"
        >
          <Textarea name="reason" rows={4} maxLength={500} />
        </Field>

        {state.error && (
          <p
            role="alert"
            className="text-[13px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3.5 py-2.5 leading-relaxed"
          >
            {state.error}
          </p>
        )}
      </div>

      <div
        className="
          shrink-0 border-t border-ink-100
          px-6 py-3 sm:py-4
          pb-[max(0.75rem,env(safe-area-inset-bottom))]
          flex items-center justify-end gap-2
        "
      >
        <Button type="button" variant="ghost" size="md" onClick={onClose}>
          Cancel
        </Button>
        <DeclineSubmit />
      </div>
    </Sheet>
  );
}

function DeclineSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="md" loading={pending}>
      {pending ? "Sending…" : "Send decline"}
    </Button>
  );
}
