"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  createLessonAction,
  type CreateLessonState,
} from "@/app/dashboard/calendar/actions";

const createLessonInitialState: CreateLessonState = { error: null, success: false };

type Option = { id: string; label: string };

export function CreateLessonPanel({
  clients,
  horses,
  trainers,
}: {
  clients: { id: string; full_name: string }[];
  horses:  { id: string; name: string }[];
  trainers: { id: string; full_name: string | null; role: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm font-medium hover:bg-neutral-800"
      >
        {open ? "Close" : "+ New lesson"}
      </button>
      {open && (
        <CreateLessonForm
          clients={clients.map((c) => ({ id: c.id, label: c.full_name }))}
          horses={horses.map((h)   => ({ id: h.id, label: h.name }))}
          trainers={trainers.map((t) => ({
            id: t.id,
            label: `${t.full_name ?? "(no name)"} (${t.role})`,
          }))}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function CreateLessonForm({
  clients,
  horses,
  trainers,
  onClose,
}: {
  clients: Option[];
  horses: Option[];
  trainers: Option[];
  onClose: () => void;
}) {
  const [state, formAction] = useFormState<CreateLessonState, FormData>(
    createLessonAction, createLessonInitialState,
  );

  // datetime-local inputs are timezone-naive. We mirror them into hidden
  // fields converted to ISO so the server gets unambiguous UTC timestamps.
  const [startsLocal, setStartsLocal] = useState("");
  const [endsLocal, setEndsLocal] = useState("");
  const startsISO = toISO(startsLocal);
  const endsISO = toISO(endsLocal);

  // Auto-close on success.
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
          <h2 className="text-lg font-semibold">New lesson</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-neutral-500 hover:text-neutral-900"
          >
            ✕
          </button>
        </div>

        <Select label="Client"  name="client_id"  options={clients} />
        <Select label="Horse"   name="horse_id"   options={horses} />
        <Select label="Trainer" name="trainer_id" options={trainers} />

        <Field
          label="Starts"
          type="datetime-local"
          required
          value={startsLocal}
          onChange={(e) => setStartsLocal(e.target.value)}
        />
        <input type="hidden" name="starts_at" value={startsISO} />

        <Field
          label="Ends"
          type="datetime-local"
          required
          value={endsLocal}
          onChange={(e) => setEndsLocal(e.target.value)}
        />
        <input type="hidden" name="ends_at" value={endsISO} />

        <Field label="Price" name="price" type="number" min="0" step="0.01" />

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-700">Notes (optional)</span>
          <textarea
            name="notes"
            rows={2}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
          />
        </label>

        <Submit label="Create lesson" />
        {state.error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}

// ---------- small primitives ----------
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

function Select({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: Option[];
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-neutral-700 font-medium">{label}</span>
      <select
        name={name}
        required
        defaultValue=""
        className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
      >
        <option value="" disabled>
          Select…
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded-md bg-neutral-900 text-white py-2.5 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Creating…" : label}
    </button>
  );
}

function toISO(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}
