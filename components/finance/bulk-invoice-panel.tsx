"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  bulkGenerateAction,
  getGeneratePreview,
  type InvoicesActionState,
} from "@/app/dashboard/finance/invoices/actions";
import type { GeneratePreview } from "@/services/invoices";

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
  const [preview, setPreview] = useState<GeneratePreview | null>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function openConfirm() {
    setPreviewErr(null);
    setPreview(null);
    startTransition(async () => {
      const res = await getGeneratePreview(period);
      if ("error" in res) setPreviewErr(res.error);
      else                setPreview(res);
    });
  }

  function closeConfirm() {
    setPreview(null);
    setPreviewErr(null);
  }

  return (
    <section className="bg-white rounded-2xl shadow-soft p-5">
      <header className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-navy-900">Generate monthly invoices</h2>
      </header>
      <p className="text-[13px] text-ink-500 mb-4">
        Pick a month. We&apos;ll create one invoice per client containing all of
        their completed, unpaid, uninvoiced lessons in that period.
      </p>

      <div className="flex flex-wrap items-end gap-3">
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
        <button
          type="button"
          onClick={openConfirm}
          disabled={pending || disabled}
          className="h-10 px-4 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title={disabled ? "Fill issuer details first" : undefined}
        >
          {pending ? "Calculating…" : "Preview &amp; generate"}
        </button>
      </div>

      {previewErr && (
        <p className="mt-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 px-3 py-2 text-[13px]">
          {previewErr}
        </p>
      )}

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

      {/* Confirm dialog with preview ----------------------------------- */}
      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4"
          onClick={closeConfirm}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-ink-900">Confirm bulk generation</h3>
            <p className="text-[13px] text-ink-600">
              For <strong>{period}</strong>, this will create:
            </p>
            <div className="rounded-xl bg-ink-50 px-4 py-3 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] uppercase tracking-[0.12em] text-ink-500 font-semibold">Invoices</p>
                <p className="text-xl font-semibold text-ink-900 mt-1 tabular-nums">{preview.eligibleClients}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.12em] text-ink-500 font-semibold">Lessons</p>
                <p className="text-xl font-semibold text-ink-900 mt-1 tabular-nums">{preview.totalLessons}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.12em] text-ink-500 font-semibold">Total</p>
                <p className="text-xl font-semibold text-emerald-700 mt-1 tabular-nums">€{preview.totalAmount.toFixed(2)}</p>
              </div>
            </div>
            {preview.eligibleClients === 0 ? (
              <p className="text-[12px] text-ink-500">
                No lessons match for that period. Nothing will be created.
              </p>
            ) : (
              <p className="text-[12px] text-ink-500">
                Each invoice gets a sequential number and is marked &quot;issued&quot;.
                You can still cancel any of them afterwards.
              </p>
            )}
            <form action={(fd) => { dispatch(fd); closeConfirm(); }} className="flex justify-end gap-2">
              <input type="hidden" name="period" value={period} />
              <button
                type="button"
                onClick={closeConfirm}
                className="h-9 px-3 rounded-lg text-[12.5px] font-medium text-ink-700 hover:bg-ink-100"
              >
                Cancel
              </button>
              <ConfirmButton disabled={preview.eligibleClients === 0} />
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function ConfirmButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="h-9 px-3 rounded-lg text-[12.5px] font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Generating…" : "Yes, create invoices"}
    </button>
  );
}
