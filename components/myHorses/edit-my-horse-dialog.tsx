"use client";

// Horse-owner edit dialog.
//
// Rendered only for clients whose owner_client_id matches the horse —
// the parent server page (/dashboard/my-horses/[id]/page.tsx) gates
// this render. The dialog itself opens an in-page sheet, runs the
// editMyHorseAction, and revalidates on success so the page reflects
// the new bio without a full reload.

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  editMyHorseAction,
  type EditMyHorseState,
} from "@/app/dashboard/my-horses/[id]/actions";

const initial: EditMyHorseState = { error: null, success: false };

type Props = {
  horseId:    string;
  initialName:    string;
  initialBreed:   string | null;
  initialDob:     string | null;
  initialNotes:   string | null;
  initialPublicBio: string | null;
};

export function EditMyHorseButton(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="
          h-9 px-3.5 rounded-xl text-sm font-medium
          text-brand-700 bg-brand-50 hover:bg-brand-100
          transition-colors
        "
      >
        Edit details
      </button>
      {open && <Dialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function Dialog({
  horseId,
  initialName,
  initialBreed,
  initialDob,
  initialNotes,
  initialPublicBio,
  onClose,
}: Props & { onClose: () => void }) {
  const [state, formAction] = useFormState<EditMyHorseState, FormData>(
    editMyHorseAction,
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
          <h2 className="text-lg font-semibold">Edit horse details</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-neutral-500 hover:text-neutral-900 px-2 py-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-3 flex flex-col gap-3.5">
          <input type="hidden" name="horse_id" value={horseId} />

          <Field label="Name" name="name" type="text" defaultValue={initialName} required />
          <Field label="Breed" name="breed" type="text" defaultValue={initialBreed ?? ""} placeholder="e.g. Hanoverian" />
          <Field label="Date of birth" name="date_of_birth" type="date" defaultValue={initialDob ?? ""} />

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-700 font-medium">Notes (private)</span>
            <textarea
              name="notes"
              rows={3}
              defaultValue={initialNotes ?? ""}
              placeholder="Quirks, preferences, vet notes only you should see…"
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-700 font-medium">Public bio</span>
            <textarea
              name="public_bio"
              rows={3}
              defaultValue={initialPublicBio ?? ""}
              placeholder="What riders should know about your horse — temperament, what they enjoy, what to avoid."
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
            />
            <span className="text-[11px] text-neutral-500">
              Visible to riders who train on your horse.
            </span>
          </label>

          {state.error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {state.error}
            </p>
          )}

          <p className="text-[11.5px] text-neutral-500 mt-2">
            Workload limits, active status, and the stable&apos;s session log
            stay managed by the stable owner. If you need to change one of
            those — message your trainer.
          </p>
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

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full sm:w-auto rounded-md bg-neutral-900 text-white py-3 sm:py-2.5 px-4 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}
