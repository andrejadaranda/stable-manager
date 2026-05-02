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
      className="fixed inset-0 z-30 flex items-start justify-center pt-8 md:pt-16 bg-black/40 backdrop-blur-sm overflow-y-auto"
    >
      <div className="bg-white rounded-xl shadow-xl border border-neutral-200 p-6 w-full max-w-md flex flex-col gap-3.5 max-h-[calc(100vh-4rem)] overflow-y-auto my-auto">
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
          <span className="text-neutral-700 font-medium">Notes (private)</span>
          <textarea
            name="notes"
            rows={2}
            defaultValue={horse.notes ?? ""}
            placeholder="Internal notes — only staff see this."
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
          />
        </label>

        <Field
          label="Photo URL"
          name="photo_url"
          type="url"
          placeholder="https://… (paste link to a public image)"
          defaultValue={(horse as HorseRow & { photo_url?: string | null }).photo_url ?? ""}
        />

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-neutral-700 font-medium">Public bio</span>
          <textarea
            name="public_bio"
            rows={3}
            maxLength={600}
            defaultValue={horse.public_bio ?? ""}
            placeholder="Visible to clients on their portal. e.g. 'Bella is a chestnut mare with a white blaze. She loves carrots and is great with beginners.'"
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
          />
          <span className="text-[11px] text-neutral-500">
            Helps young riders recognise the horse before their lesson.
          </span>
        </label>

        {/* Backup contact — when the owner can't be reached */}
        <fieldset className="border-t border-neutral-200 pt-3.5 mt-1 flex flex-col gap-2.5">
          <legend className="text-[10px] uppercase tracking-[0.14em] font-semibold text-neutral-500 px-1">
            Backup contact
          </legend>
          <p className="text-[11px] text-neutral-500 -mt-1">
            Who do we call when the owner is unreachable (vet decisions, transport, end-of-life). Survives ownership changes.
          </p>
          <Field label="Name" name="backup_contact_name" type="text" defaultValue={(horse as HorseRow & { backup_contact_name?: string | null }).backup_contact_name ?? ""} placeholder="e.g. Marija Vilkienė" />
          <Field label="Phone" name="backup_contact_phone" type="tel" defaultValue={(horse as HorseRow & { backup_contact_phone?: string | null }).backup_contact_phone ?? ""} placeholder="+370 6…" />
          <Field label="Relationship" name="backup_contact_relation" type="text" defaultValue={(horse as HorseRow & { backup_contact_relation?: string | null }).backup_contact_relation ?? ""} placeholder="vet, neighbour, partner…" />
        </fieldset>

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
