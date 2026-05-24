"use client";

// Horse-owner submits a new care request for their horse.
// Same shape as edit-my-horse-dialog: full-screen sheet on mobile,
// modal on desktop, sticky footer with safe-area padding.

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  submitCareRequestAction,
  type CareRequestActionState,
} from "@/app/dashboard/my-horses/[id]/care-actions";
import { CARE_TYPE_LABEL, CARE_TYPE_EMOJI, type CareRequestType } from "@/services/careRequests.types";

const initial: CareRequestActionState = { error: null, success: false };

const TYPE_ORDER: CareRequestType[] = ["farrier", "vet", "feed", "equipment", "transport", "other"];

export function NewCareRequestButton({ horseId, horseName }: { horseId: string; horseName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="
          h-10 px-4 rounded-xl text-sm font-medium
          bg-brand-500 text-white hover:bg-brand-600
          transition-colors inline-flex items-center gap-2
        "
      >
        <span aria-hidden>+</span> Request a service
      </button>
      {open && (
        <Dialog horseId={horseId} horseName={horseName} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function Dialog({
  horseId,
  horseName,
  onClose,
}: {
  horseId: string;
  horseName: string;
  onClose: () => void;
}) {
  const [state, formAction] = useFormState<CareRequestActionState, FormData>(
    submitCareRequestAction,
    initial,
  );
  const [type, setType] = useState<CareRequestType>("farrier");

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
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Request a service</h2>
            <p className="text-[12.5px] text-neutral-500 mt-0.5 truncate">For {horseName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-neutral-500 hover:text-neutral-900 px-2 py-1 shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 flex flex-col gap-4">
          <input type="hidden" name="horse_id" value={horseId} />
          <input type="hidden" name="type"     value={type} />

          <div>
            <span className="text-[11px] uppercase tracking-wider font-semibold text-ink-500 block mb-2">
              What do you need?
            </span>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_ORDER.map((t) => {
                const active = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`
                      inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium
                      border transition-colors text-left
                      ${active
                        ? "bg-brand-50 border-brand-300 text-brand-800"
                        : "bg-white border-neutral-200 text-ink-700 hover:bg-neutral-50"}
                    `}
                  >
                    <span aria-hidden className="text-base">{CARE_TYPE_EMOJI[t]}</span>
                    <span>{CARE_TYPE_LABEL[t]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-700 font-medium">Urgency</span>
            <select
              name="urgency"
              defaultValue="normal"
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="low">Whenever — no rush</option>
              <option value="normal">Soon — within a week</option>
              <option value="high">Urgent — this week if possible</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-700 font-medium">Preferred date <span className="text-neutral-400 font-normal">(optional)</span></span>
            <input
              type="date"
              name="preferred_date"
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-700 font-medium">Notes for the stable</span>
            <textarea
              name="notes"
              rows={4}
              placeholder="e.g. front hoof a little long, schedule with our regular farrier if possible…"
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
            />
            <span className="text-[11px] text-neutral-500">
              The stable owner will see this and respond inside the app.
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
      className="w-full sm:w-auto rounded-md bg-brand-600 text-white py-3 sm:py-2.5 px-4 text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Sending…" : "Send request"}
    </button>
  );
}
