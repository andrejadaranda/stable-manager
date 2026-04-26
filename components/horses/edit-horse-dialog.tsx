"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  updateHorseAction,
  type UpdateHorseState,
} from "@/app/dashboard/horses/actions";
import type { HorseRow } from "@/services/horses";

const initial: UpdateHorseState = { error: null, success: false };

export function EditHorseButton({ horse }: { horse: HorseRow }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-100"
      >
        Edit
      </button>
      {open && <EditHorseDialog horse={horse} onClose={() => setOpen(false)} />}
    </>
  );
}

function EditHorseDialog({
  horse,
  onClose,
}: {
  horse: HorseRow;
  onClose: () => void;
}) {
  const [state, formAction] = useFormState<UpdateHorseState, FormData>(
    updateHorseAction,
    initial,
  );

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  return (
    <form
      action={formAction}
      className="fixed inset-0 z-30 flex items-start justify-center pt-16 bg-black/40 backdrop-blur-sm"
    >
      <div className="bg-white rounded-xl shadow-xl border border-neutral-200 p-6 w-full max-w-md flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit horse</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-neutral-500 hover:text-neutral-900"
          >
            ✕
          </button>
        </div>

        <input type="hidden" name="horse_id" value={horse.id} />

        <Field label="Name" name="name" type="text" required defaultValue={horse.name} />

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-neutral-700 font-medium">Status</span>
          <select
            name="status"
            defaultValue={horse.active ? "active" : "inactive"}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>

        <Field
          label="Max lessons per day"
          name="daily_lesson_limit"
          type="number"
          min="0"
          step="1"
          defaultValue={String(horse.daily_lesson_limit)}
        />
        <Field
          label="Max lessons per week"
          name="weekly_lesson_limit"
          type="number"
          min="0"
          step="1"
          defaultValue={String(horse.weekly_lesson_limit)}
        />

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-neutral-700 font-medium">Notes</span>
          <textarea
            name="notes"
            rows={2}
            defaultValue={horse.notes ?? ""}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
          />
        </label>

        <Submit />
        {state.error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {state.error}
          </p>
        )}
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
      className="mt-2 rounded-md bg-neutral-900 text-white py-2.5 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}
