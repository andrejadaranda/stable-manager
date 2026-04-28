"use client";

// Quick-add session sheet for the horse profile. Compact 4-field flow:
// started_at, rider, type, duration. Horse is fixed (we're already on
// its page) so the sheet feels like an action, not a form.
//
// Reuses the existing createSessionAction from app/dashboard/sessions/actions.ts —
// we don't fork a new action, we just build a thinner UI for it.

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import {
  createSessionAction,
  type CreateSessionState,
} from "@/app/dashboard/sessions/actions";
import { SESSION_TYPES, type SessionType } from "@/services/sessions.types";

const initialState: CreateSessionState = { error: null, success: false };

const TYPE_LABEL: Record<SessionType, string> = {
  flat: "Flat",
  jumping: "Jumping",
  lunging: "Lunging",
  groundwork: "Groundwork",
  hack: "Hack",
  other: "Other",
};

type ClientOpt = { id: string; full_name: string };

/** Local datetime-local string for "now rounded to next 15 min". */
function nowRoundedLocal(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AddSessionFAB({
  horseId,
  clients,
}: {
  horseId: string;
  clients: ClientOpt[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="
          fixed bottom-6 right-6 z-30
          h-12 px-5 rounded-full
          bg-brand-600 text-white text-sm font-medium
          shadow-lift hover:bg-brand-700 active:bg-brand-800
          inline-flex items-center gap-2
          md:absolute md:bottom-auto md:top-0 md:right-0 md:h-9 md:px-3.5 md:shadow-sm md:rounded-lg
        "
        aria-label="Add session"
      >
        <span aria-hidden className="text-base leading-none">+</span>
        <span>Add session</span>
      </button>

      {open && (
        <AddSessionSheet
          horseId={horseId}
          clients={clients}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function AddSessionSheet({
  horseId,
  clients,
  onClose,
}: {
  horseId: string;
  clients: ClientOpt[];
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(createSessionAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Close after successful save — also triggers parent revalidate via
  // revalidatePath(`/dashboard/horses/${horseId}`) in the action.
  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  // Lock body scroll while sheet is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Esc to close.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end md:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Log a new session"
    >
      <div
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="
          relative w-full md:max-w-md
          bg-surface md:rounded-2xl rounded-t-2xl
          shadow-lift
          max-h-[92vh] overflow-y-auto
          animate-in slide-in-from-bottom md:slide-in-from-bottom-0
        "
      >
        <form ref={formRef} action={formAction} className="p-5 md:p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink-900">Add session</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-ink-400 hover:text-ink-900 p-1 -mr-1 rounded-lg"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <input type="hidden" name="horse_id" value={horseId} />

          {/* Started at */}
          <label className="block">
            <span className="block text-[11.5px] font-medium tracking-[0.04em] uppercase text-ink-500 mb-1.5">
              When
            </span>
            <input
              type="datetime-local"
              name="started_at"
              defaultValue={nowRoundedLocal()}
              required
              className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
            />
          </label>

          {/* Rider — choose client OR freeform name */}
          <div className="flex flex-col gap-2">
            <span className="block text-[11.5px] font-medium tracking-[0.04em] uppercase text-ink-500">
              Rider
            </span>
            {clients.length > 0 ? (
              <select
                name="rider_client_id"
                defaultValue=""
                className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
              >
                <option value="">— pick a client —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            ) : null}
            <input
              type="text"
              name="rider_name"
              placeholder="…or type a name (drop-in rider)"
              className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
            />
          </div>

          {/* Type — chip group */}
          <fieldset className="flex flex-col gap-2">
            <legend className="block text-[11.5px] font-medium tracking-[0.04em] uppercase text-ink-500 mb-0.5">
              Type
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {SESSION_TYPES.map((t, i) => (
                <label key={t} className="cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    defaultChecked={i === 0}
                    className="peer sr-only"
                  />
                  <span
                    className="
                      inline-block px-3 py-1.5 rounded-full text-[12.5px]
                      bg-ink-100 text-ink-700
                      peer-checked:bg-brand-600 peer-checked:text-white
                      transition-colors
                    "
                  >
                    {TYPE_LABEL[t]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Duration */}
          <label className="block">
            <span className="block text-[11.5px] font-medium tracking-[0.04em] uppercase text-ink-500 mb-1.5">
              Duration · minutes
            </span>
            <input
              type="number"
              name="duration_minutes"
              defaultValue={60}
              min={1}
              max={600}
              required
              className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
            />
          </label>

          {state.error && (
            <p className="text-xs text-rose-600">{state.error}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl text-sm text-ink-700 hover:bg-ink-100/60"
            >
              Cancel
            </button>
            <SubmitButton />
          </div>
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  // useFormStatus would give us pending state, but we already have state.success.
  return (
    <button
      type="submit"
      className="h-10 px-5 rounded-xl bg-brand-600 text-white text-sm font-medium shadow-sm hover:bg-brand-700 active:bg-brand-800"
    >
      Save session
    </button>
  );
}
