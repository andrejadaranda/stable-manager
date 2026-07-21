"use client";

// "Generate this month's bill" — one tap turns a client's whole month of
// billable items into a faktūra (delivered/paid) + a proforma (future
// scheduled). Shows links to both documents on success.

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import {
  generateClientDocumentsAction,
  type GenerateDocsState,
} from "@/app/dashboard/clients/[id]/document-actions";

const INIT: GenerateDocsState = { error: null, result: null };

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 px-4 rounded-xl text-[13px] font-semibold bg-brand-700 text-white hover:bg-brand-800 disabled:opacity-60 transition-colors"
    >
      {pending ? "Generating…" : "Generate this month's bill"}
    </button>
  );
}

export function GenerateBillButton({ clientId }: { clientId: string }) {
  const [state, action] = useFormState(generateClientDocumentsAction, INIT);

  return (
    <div className="bg-white border border-ink-100 rounded-2xl shadow-soft p-4 flex flex-col gap-3">
      <div>
        <h3 className="font-serif font-semibold text-[16px] text-ink-900">This month&apos;s bill</h3>
        <p className="text-[12.5px] text-ink-500 mt-0.5 leading-relaxed">
          Everything for this person this month — lessons, boarding, farrier/vet — as a <b>faktūra</b>{" "}
          (delivered) plus an <b>išankstinė / proforma</b> (upcoming, not yet delivered).
        </p>
      </div>

      <form action={action}>
        <input type="hidden" name="client_id" value={clientId} />
        <SubmitBtn />
      </form>

      {state.error && <p className="text-[12.5px] text-alert-600">{state.error}</p>}

      {state.result && (
        <div className="flex flex-col gap-1.5 text-[13px]">
          {state.result.invoiceId && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-brand-50 px-3 py-2">
              <span className="text-brand-800 font-medium">Faktūra · €{state.result.invoiceTotal.toFixed(2)}</span>
              <Link href={`/dashboard/finance/invoices/${state.result.invoiceId}`} className="text-brand-700 font-semibold underline">Open</Link>
            </div>
          )}
          {state.result.proformaId && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-ink-50 px-3 py-2">
              <span className="text-ink-700 font-medium">Proforma · €{state.result.proformaTotal.toFixed(2)}</span>
              <Link href={`/dashboard/finance/invoices/${state.result.proformaId}`} className="text-brand-700 font-semibold underline">Open</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
