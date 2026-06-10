"use client";

// Client portal — "Request an invoice". The client asks the stable to issue
// an invoice and says what for. Pending requests are listed with a Cancel.

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  createInvoiceRequestAction,
  cancelInvoiceRequestAction,
  type RequestInvoiceState,
} from "@/app/dashboard/my-payments/invoice-request-actions";
import type { InvoiceRequestRow } from "@/services/invoiceRequests";

const initial: RequestInvoiceState = { error: null, success: false };

const STATUS_TONE: Record<string, string> = {
  pending:   "bg-amber-50  text-amber-700",
  fulfilled: "bg-emerald-50 text-emerald-700",
  dismissed: "bg-ink-100   text-ink-500",
};

export function RequestInvoicePanel({ requests }: { requests: InvoiceRequestRow[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(createInvoiceRequestAction, initial);

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state.success]);

  const recent = requests.slice(0, 5);

  return (
    <section className="bg-white rounded-2xl shadow-soft p-5 md:p-6">
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 className="font-display text-xl text-navy-900">Request an invoice</h2>
          <p className="text-[12.5px] text-ink-500 mt-1">
            Ask your stable to issue an invoice — tell them what it&apos;s for.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-9 px-3 rounded-lg text-[12px] font-medium text-white bg-brand-600 hover:bg-brand-700"
          >
            Request an invoice
          </button>
        )}
      </div>

      {open && (
        <form action={action} className="flex flex-col gap-2 mb-4">
          <textarea
            name="note"
            rows={3}
            maxLength={1000}
            placeholder="e.g. Please invoice my June boarding and the farrier visit for Vytis."
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-[13px] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
          />
          {state.error && <p className="text-[12px] text-rose-600">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[12px] text-ink-500 hover:text-ink-900 px-2 py-1"
            >
              Cancel
            </button>
            <SubmitButton />
          </div>
        </form>
      )}

      {recent.length > 0 && (
        <ul className="flex flex-col gap-2">
          {recent.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-ink-100 bg-white px-4 py-3 flex items-start justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] text-ink-700 whitespace-pre-wrap">
                  {r.note || "Invoice requested"}
                </p>
                <p className="text-[11px] text-ink-400 mt-1">
                  {new Date(r.created_at).toLocaleDateString("en-GB", {
                    day: "2-digit", month: "short", year: "numeric",
                  })}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${STATUS_TONE[r.status] ?? ""}`}>
                  {r.status}
                </span>
                {r.status === "pending" && <CancelButton requestId={r.id} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-[12px] text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-md font-medium disabled:opacity-50"
    >
      {pending ? "Sending…" : "Send request"}
    </button>
  );
}

function CancelButton({ requestId }: { requestId: string }) {
  const [, action] = useFormState(cancelInvoiceRequestAction, initial);
  return (
    <form action={action}>
      <input type="hidden" name="request_id" value={requestId} />
      <button type="submit" className="text-[11px] text-red-600 hover:text-red-800">
        Cancel
      </button>
    </form>
  );
}
