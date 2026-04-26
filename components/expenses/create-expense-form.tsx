"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  addExpenseAction,
  type AddExpenseState,
} from "@/app/dashboard/expenses/actions";

const addExpenseInitialState: AddExpenseState = { error: null, success: false };

type HorseOpt = { id: string; name: string };

export function CreateExpensePanel({ horses }: { horses: HorseOpt[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm font-medium hover:bg-neutral-800"
      >
        {open ? "Close" : "+ New expense"}
      </button>
      {open && <CreateExpenseForm horses={horses} onClose={() => setOpen(false)} />}
    </>
  );
}

function CreateExpenseForm({
  horses,
  onClose,
}: {
  horses: HorseOpt[];
  onClose: () => void;
}) {
  const [state, formAction] = useFormState<AddExpenseState, FormData>(
    addExpenseAction, addExpenseInitialState,
  );
  const [date, setDate] = useState<string>(toDateInputValue(new Date()));

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
          <h2 className="text-lg font-semibold">Record expense</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-neutral-500 hover:text-neutral-900"
          >
            ✕
          </button>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-700">Category</span>
          <select
            name="category"
            required
            defaultValue=""
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="" disabled>Select…</option>
            <option value="feed">Feed</option>
            <option value="vet">Vet</option>
            <option value="farrier">Farrier</option>
            <option value="maintenance">Maintenance</option>
            <option value="staff">Staff</option>
            <option value="other">Other</option>
          </select>
        </label>

        <Field
          label="Amount"
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          required
        />

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-700">Expense date</span>
          <input
            type="date"
            name="incurred_on"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-700">Horse (optional)</span>
          <select
            name="horse_id"
            defaultValue=""
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="">— None —</option>
            {horses.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-700">Notes (optional)</span>
          <textarea
            name="notes"
            rows={2}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
          />
        </label>

        <Submit label="Record expense" />
        {state.error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}

// ---------- primitives ----------
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

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded-md bg-neutral-900 text-white py-2.5 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
