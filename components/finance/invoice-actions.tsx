"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  markPaidAction,
  markUnpaidAction,
  cancelInvoiceAction,
  emailInvoiceAction,
  type InvoiceStatusState,
  type EmailInvoiceState,
} from "@/app/dashboard/finance/invoices/[id]/actions";

const initial: InvoiceStatusState = { error: null, success: false };
const emailInitial: EmailInvoiceState = { error: null, sentTo: null };

export function InvoiceActions({
  invoiceId,
  status,
  clientEmail,
}: {
  invoiceId: string;
  status: "issued" | "paid" | "overdue" | "cancelled";
  clientEmail?: string | null;
}) {
  const [, paid]      = useFormState<InvoiceStatusState, FormData>(markPaidAction,      initial);
  const [, unpaid]    = useFormState<InvoiceStatusState, FormData>(markUnpaidAction,    initial);
  const [, cancelled] = useFormState<InvoiceStatusState, FormData>(cancelInvoiceAction, initial);
  const [emailState, emailDispatch] = useFormState<EmailInvoiceState, FormData>(emailInvoiceAction, emailInitial);

  return (
    <div className="flex gap-2 flex-wrap items-center">
      <button
        type="button"
        onClick={() => window.print()}
        className="h-9 px-3 rounded-lg text-[12px] font-medium text-brand-700 bg-brand-50 hover:bg-brand-100"
      >
        Print / PDF
      </button>

      {clientEmail && (
        <form action={emailDispatch}>
          <input type="hidden" name="invoice_id" value={invoiceId} />
          <EmailButton />
        </form>
      )}
      {emailState.sentTo && (
        <span className="text-[12px] text-emerald-700">Sent to {emailState.sentTo} ✓</span>
      )}
      {emailState.error && (
        <span className="text-[12px] text-rose-700">{emailState.error}</span>
      )}

      {status === "issued" && (
        <form action={paid}>
          <input type="hidden" name="invoice_id" value={invoiceId} />
          <ActionButton variant="emerald" label="Mark paid" />
        </form>
      )}
      {status === "paid" && (
        <form action={unpaid}>
          <input type="hidden" name="invoice_id" value={invoiceId} />
          <ActionButton variant="ink" label="Mark unpaid" />
        </form>
      )}
      {status !== "cancelled" && (
        <form action={cancelled}>
          <input type="hidden" name="invoice_id" value={invoiceId} />
          <ActionButton variant="rose" label="Cancel invoice" />
        </form>
      )}
    </div>
  );
}

function EmailButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-9 px-3 rounded-lg text-[12px] font-medium bg-navy-50 text-navy-800 hover:bg-navy-100 disabled:opacity-50"
    >
      {pending ? "Sending…" : "Email to client"}
    </button>
  );
}

function ActionButton({ variant, label }: { variant: "emerald" | "ink" | "rose"; label: string }) {
  const { pending } = useFormStatus();
  const cls =
    variant === "emerald" ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100" :
    variant === "rose"    ? "bg-rose-50 text-rose-700 hover:bg-rose-100"          :
                            "bg-ink-50 text-ink-700 hover:bg-ink-100";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`h-9 px-3 rounded-lg text-[12px] font-medium disabled:opacity-50 ${cls}`}
    >
      {pending ? "…" : label}
    </button>
  );
}
