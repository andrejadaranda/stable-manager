"use client";

// Owner/trainer view of pending invoice requests from clients. Each can be
// fulfilled (generate the invoice + open it) or dismissed.

import { useFormState, useFormStatus } from "react-dom";
import {
  fulfillInvoiceRequestAction,
  dismissInvoiceRequestAction,
  type ReqActionState,
} from "@/app/dashboard/finance/invoices/request-actions";
import type { InvoiceRequestForStaff } from "@/services/invoiceRequests";

const initial: ReqActionState = { error: null };

export function InvoiceRequestsSection({ requests }: { requests: InvoiceRequestForStaff[] }) {
  if (requests.length === 0) return null;

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-sm font-semibold text-amber-900">
          Requested by clients ({requests.length})
        </h2>
        <span className="text-[11px] uppercase tracking-wider font-medium text-amber-700">
          Generate to bill un-invoiced items
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {requests.map((r) => (
          <RequestRow key={r.id} r={r} />
        ))}
      </ul>
    </section>
  );
}

function RequestRow({ r }: { r: InvoiceRequestForStaff }) {
  const [fulfillState, fulfill] = useFormState(fulfillInvoiceRequestAction, initial);
  const [dismissState, dismiss] = useFormState(dismissInvoiceRequestAction, initial);
  const err = fulfillState.error || dismissState.error;

  return (
    <li className="rounded-xl border border-amber-100 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-900">{r.client_name ?? "Client"}</p>
          {r.note && (
            <p className="text-[12.5px] text-ink-700 mt-0.5 whitespace-pre-wrap">{r.note}</p>
          )}
          <p className="text-[11px] text-ink-400 mt-1">
            {new Date(r.created_at).toLocaleDateString("en-GB", {
              day: "2-digit", month: "short", year: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <form action={fulfill}>
            <input type="hidden" name="request_id" value={r.id} />
            <FulfillButton />
          </form>
          <form action={dismiss}>
            <input type="hidden" name="request_id" value={r.id} />
            <button type="submit" className="h-9 px-3 rounded-lg text-[12px] font-medium text-ink-600 hover:bg-ink-100">
              Dismiss
            </button>
          </form>
        </div>
      </div>
      {err && <p className="text-[12px] text-rose-700 mt-2">{err}</p>}
    </li>
  );
}

function FulfillButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-9 px-3 rounded-lg text-[12px] font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "Generating…" : "Generate invoice"}
    </button>
  );
}
