"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  updateClientAction,
  type UpdateClientState,
} from "@/app/dashboard/clients/actions";
import type { ClientRow } from "@/services/clients";

const initial: UpdateClientState = { error: null, success: false };

export function EditClientButton({ client }: { client: ClientRow }) {
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
      {open && <EditClientDialog client={client} onClose={() => setOpen(false)} />}
    </>
  );
}

function EditClientDialog({
  client,
  onClose,
}: {
  client: ClientRow;
  onClose: () => void;
}) {
  const [state, formAction] = useFormState<UpdateClientState, FormData>(
    updateClientAction,
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
          <h2 className="text-lg font-semibold">Edit client</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-neutral-500 hover:text-neutral-900"
          >
            ✕
          </button>
        </div>

        <input type="hidden" name="client_id" value={client.id} />

        <Field label="Full name" name="full_name" type="text" required defaultValue={client.full_name} />
        <Field label="Phone (optional)" name="phone" type="tel" defaultValue={client.phone ?? ""} />
        <Field label="Email (optional)" name="email" type="email" defaultValue={client.email ?? ""} />

        <label className="flex items-start gap-2.5 text-sm bg-ink-50/40 rounded-lg px-3 py-2.5 cursor-pointer">
          <input
            type="checkbox"
            name="is_horse_owner_only"
            defaultChecked={(client as ClientRow & { is_horse_owner_only?: boolean }).is_horse_owner_only ?? false}
            value="true"
            className="mt-0.5 w-4 h-4 accent-brand-600"
          />
          <span className="flex-1">
            <span className="text-neutral-800 font-medium">Horse owner only</span>
            <span className="block text-[11.5px] text-neutral-500 mt-0.5">
              Tick if this person only boards a horse and doesn't ride. Skill level becomes optional and they're filtered to the "Owners" tab on the Clients page.
            </span>
          </span>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-neutral-700 font-medium">Skill level (optional for owners)</span>
          <select
            name="skill_level"
            defaultValue={client.skill_level ?? ""}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="">—</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="pro">Pro</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-neutral-700 font-medium">Status</span>
          <select
            name="status"
            defaultValue={client.active ? "active" : "inactive"}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-neutral-700 font-medium">Notes</span>
          <textarea
            name="notes"
            rows={2}
            defaultValue={client.notes ?? ""}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
          />
        </label>

        {/* Emergency contact — for accidents during a lesson */}
        <fieldset className="border-t border-neutral-200 pt-3.5 mt-1 flex flex-col gap-2.5">
          <legend className="text-[10px] uppercase tracking-[0.14em] font-semibold text-neutral-500 px-1">
            Emergency contact
          </legend>
          <p className="text-[11px] text-neutral-500 -mt-1">
            Who do we call if something happens during a lesson? Optional, kept private to staff.
          </p>
          <Field label="Name" name="emergency_contact_name" type="text" defaultValue={client.emergency_contact_name ?? ""} placeholder="e.g. Jonas Kazlauskas" />
          <Field label="Phone" name="emergency_contact_phone" type="tel" defaultValue={client.emergency_contact_phone ?? ""} placeholder="+370 6…" />
          <Field label="Relationship" name="emergency_contact_relation" type="text" defaultValue={client.emergency_contact_relation ?? ""} placeholder="spouse, parent, friend…" />
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
