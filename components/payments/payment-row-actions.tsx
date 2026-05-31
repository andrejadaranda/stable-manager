"use client";

// Per-row Edit + Delete for the payments list (owner only).
// Edit opens a small modal to change amount / method / date / note.
// Client + lesson links are intentionally fixed (delete + re-add for those).

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import {
  updatePaymentAction,
  deletePaymentAction,
  type AddPaymentState,
} from "@/app/dashboard/payments/actions";

const initialState: AddPaymentState = { error: null, success: false };

type Payment = {
  id: string;
  amount: number | string;
  method: "cash" | "card" | "transfer" | "other";
  paid_at: string;
  notes: string | null;
};

export function PaymentRowActions({ payment }: { payment: Payment }) {
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const [pending, startT] = useTransition();

  function onDelete() {
    if (!confirm("Delete this payment? The client's balance will update.")) return;
    startT(async () => {
      const res = await deletePaymentAction(payment.id);
      if (res.error) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-[12px] text-ink-500 hover:text-navy-900 hover:bg-ink-100/60 rounded-lg px-2 py-1 transition-colors"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="text-[12px] text-ink-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg px-2 py-1 transition-colors disabled:opacity-50"
      >
        {pending ? "…" : "Delete"}
      </button>
      {editing && <EditDialog payment={payment} onClose={() => setEditing(false)} />}
    </div>
  );
}

function EditDialog({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const [state, action] = useFormState<AddPaymentState, FormData>(updatePaymentAction, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.success) { router.refresh(); onClose(); }
  }, [state.success, onClose, router]);

  const dateValue = payment.paid_at ? new Date(payment.paid_at).toISOString().slice(0, 10) : "";

  return (
    <form
      action={action}
      className="fixed inset-0 z-40 flex items-start justify-center pt-16 bg-black/40 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl border border-neutral-200 p-6 w-full max-w-sm flex flex-col gap-3.5 my-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-900">Edit payment</h2>
          <button type="button" onClick={onClose} className="text-sm text-neutral-500 hover:text-neutral-900">✕</button>
        </div>
        <input type="hidden" name="payment_id" value={payment.id} />

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-700 font-medium">Amount · €</span>
          <input
            name="amount" type="number" min="0.01" step="0.01" required
            defaultValue={Number(payment.amount).toFixed(2)}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-700 font-medium">Date</span>
          <input
            name="paid_at" type="date" required defaultValue={dateValue}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-700 font-medium">Method</span>
          <select name="method" defaultValue={payment.method} className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white">
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="transfer">Transfer</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-700 font-medium">Note</span>
          <input
            name="notes" type="text" defaultValue={payment.notes ?? ""}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
          />
        </label>

        {state.error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{state.error}</p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl text-sm text-ink-700 hover:bg-ink-100/60">Cancel</button>
          <SaveBtn />
        </div>
      </div>
    </form>
  );
}

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="h-10 px-4 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
      {pending ? "Saving…" : "Save"}
    </button>
  );
}
