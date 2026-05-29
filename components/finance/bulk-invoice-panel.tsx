"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  bulkGenerateAction,
  type InvoicesActionState,
} from "@/app/dashboard/finance/invoices/actions";

const initial: InvoicesActionState = { error: null, result: null };

export function BulkInvoicePanel({
  period: initialPeriod,
  disabled,
}: {
  period: string;
  disabled: boolean;
}) {
  const [state, dispatch] = useFormState<InvoicesActionState, FormData>(bulkGenerateAction, initial);
  const [period, setPeriod] = useState(initialPeriod);

  return (
    <section className="bg-white rounded-2xl shadow-soft p-5">
      <header className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-navy-900">Generate monthly invoices</h2>
      </header>
      <p className="text-[13px] text-ink-500 mb-4">
        Pick a month. We&apos;ll create one invoice per client containing all of
        their completed, unpaid, uninvoiced lessons in that period.
      </p>
      <form action={dispatch} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[12px] text-ink-700">
          Period
          <input
            type="month"
            name="period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="h-10 rounded-xl border border-ink-200 bg-white text-sm px-3"
          />
        </label>
        <GenerateButton disabled={disabled} />
      </form>

      {state.error && (
        <p className="mt-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 px-3 py-2 text-[13px]">
          {state.error}
        </p>
      )}
      {state.result && (
        <p className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 px-3 py-2 text-[13px]">
          Created <strong>{state.result.created}</strong> invoice{state.result.created === 1 ? "" : "s"} for
          a total of <strong>€{state.result.totalAmount.toFixed(2)}</strong>.
          {state.result.created === 0 && (
            <span className="ml-1 text-ink-600">
              No new lessons to invoice for that period.
            </span>
          )}
        </p>
      )}
    </section>
  );
}

function GenerateButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="h-10 px-4 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
      title={disabled ? "Fill issuer details first" : undefined}
    >
      {pending ? "Generating…" : "Generate invoices"}
    </button>
  );
}
