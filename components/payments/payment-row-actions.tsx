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

const METHOD_OPTS: Array<{ value: Payment["method"]; label: string }> = [
  { value: "cash",     label: "Cash" },
  { value: "card",     label: "Card" },
  { value: "transfer", label: "Transfer" },
  { value: "other",    label: "Other" },
];

function EditDialog({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const [state, action] = useFormState<AddPaymentState, FormData>(updatePaymentAction, initialState);
  const router = useRouter();
  const [method, setMethod] = useState<Payment["method"]>(payment.method);

  useEffect(() => {
    if (state.success) { router.refresh(); onClose(); }
  }, [state.success, onClose, router]);

  const dateValue = payment.paid_at ? new Date(payment.paid_at).toISOString().slice(0, 10) : "";

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        action={action}
        className="bg-surface w-full sm:max-w-md rounded-t-[28px] sm:rounded-[28px] px-6 pt-2 pb-8 sm:pb-6 shadow-lift flex flex-col max-h-[92vh] overflow-y-auto"
      >
        <div className="w-10 h-[5px] rounded-full bg-ink-200 mx-auto my-2.5 sm:hidden" />
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-serif font-semibold text-[24px] text-ink-900">Edit payment</h2>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full bg-surface-sunken text-ink-600 inline-flex items-center justify-center hover:bg-ink-100">✕</button>
        </div>
        <input type="hidden" name="payment_id" value={payment.id} />
        <input type="hidden" name="method" value={method} />

        {/* Amount — hero field */}
        <div className="mb-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-400 mb-1.5">Amount</div>
          <div className="flex items-center gap-2.5 bg-white border-[1.5px] border-brand-500 rounded-2xl px-4 h-16 shadow-[0_0_0_3px_rgba(45,84,64,0.14)]">
            <span className="font-serif text-[26px] text-ink-400">€</span>
            <input
              name="amount" type="number" min="0.01" step="0.01" required
              defaultValue={Number(payment.amount).toFixed(2)}
              className="flex-1 border-none outline-none bg-transparent font-mono font-semibold text-[30px] text-ink-900 w-full"
            />
          </div>
        </div>

        {/* Date */}
        <div className="mb-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-400 mb-1.5">Date</div>
          <input
            name="paid_at" type="date" required defaultValue={dateValue}
            className="w-full h-[52px] bg-white border border-ink-200 rounded-2xl px-4 text-[16px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
        </div>

        {/* Method segmented */}
        <div className="mb-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-400 mb-1.5">Method</div>
          <div className="grid grid-cols-4 gap-2">
            {METHOD_OPTS.map((o) => {
              const on = method === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setMethod(o.value)}
                  className={`h-14 rounded-2xl border-[1.5px] text-[13px] font-semibold transition-colors ${
                    on
                      ? "border-brand-600 bg-brand-50 text-brand-700 shadow-[0_0_0_3px_rgba(45,84,64,0.12)]"
                      : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Note */}
        <div className="mb-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-400 mb-1.5">Note</div>
          <input
            name="notes" type="text" defaultValue={payment.notes ?? ""}
            placeholder="Optional reference…"
            className="w-full h-[52px] bg-white border border-ink-200 rounded-2xl px-4 text-[16px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
        </div>

        {state.error && (
          <p className="text-sm text-alert-700 bg-alert-100 rounded-xl px-3 py-2 mt-2">{state.error}</p>
        )}

        <div className="flex items-center justify-end gap-3 mt-6">
          <button type="button" onClick={onClose} className="text-[15px] font-semibold text-ink-600 px-4 py-3 hover:text-ink-900">Cancel</button>
          <SaveBtn />
        </div>
      </form>
    </div>
  );
}

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="h-[50px] px-7 rounded-2xl bg-brand-700 text-white text-[15px] font-bold shadow-lift hover:bg-brand-800 disabled:opacity-50">
      {pending ? "Saving…" : "Save"}
    </button>
  );
}
