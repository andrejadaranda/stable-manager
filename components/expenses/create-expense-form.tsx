"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import {
  addExpenseAction,
  type AddExpenseState,
} from "@/app/dashboard/expenses/actions";

const addExpenseInitialState: AddExpenseState = { error: null, success: false };

type HorseOpt = { id: string; name: string };

export function CreateExpensePanel({ horses }: { horses: HorseOpt[] }) {
  const [open, setOpen] = useState(false);
  // Empty-state "Add an expense" CTA links to ?new=1 — auto-open.
  const sp = useSearchParams();
  useEffect(() => {
    if (sp.get("new") === "1") setOpen(true);
  }, [sp]);
  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700"
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
      className="fixed inset-0 z-30 flex items-start justify-center pt-8 md:pt-16 bg-black/40 backdrop-blur-sm overflow-y-auto"
    >
      <div className="bg-white rounded-xl shadow-xl border border-neutral-200 p-6 w-full max-w-md flex flex-col gap-3.5 max-h-[calc(100vh-4rem)] overflow-y-auto my-auto">
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
            <optgroup label="Feed & bedding">
              <option value="feed">Feed (concentrate)</option>
              <option value="hay">Hay / grass</option>
              <option value="bedding">Bedding (straw, shavings)</option>
              <option value="supplements">Supplements (vitamins, joint, hoof)</option>
            </optgroup>
            <optgroup label="Health & care">
              <option value="vet">Vet</option>
              <option value="farrier">Farrier</option>
            </optgroup>
            <optgroup label="Gear & equipment">
              <option value="tack">Tack (saddles, bridles, blankets)</option>
              <option value="equipment">Equipment (yard tools, machinery)</option>
              <option value="repair">Repair (something broke)</option>
              <option value="maintenance">Maintenance (routine upkeep)</option>
            </optgroup>
            <optgroup label="Business">
              <option value="insurance">Insurance</option>
              <option value="competition">Competition entry / stabling</option>
              <option value="transport">Transport (trailer fuel, haulers)</option>
              <option value="utilities">Utilities (electricity, water)</option>
              <option value="registration">Registration / federation fees</option>
              <option value="staff">Staff (wages, contractors)</option>
            </optgroup>
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
          <span className="text-neutral-700 font-medium">Tag to a horse (optional)</span>
          <select
            name="horse_id"
            defaultValue=""
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="">— Stable-wide (no specific horse) —</option>
            {horses.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <span className="text-[11.5px] text-neutral-500 mt-1">
            Leave on <strong>Stable-wide</strong> for shared costs (hay delivery, arena footing, insurance). Pick a horse when the cost is for that specific animal (vet bill, dental float).
          </span>
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
      className="mt-2 rounded-md bg-brand-600 text-white py-2.5 text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
