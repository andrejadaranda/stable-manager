"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  markPaidAction,
  markUnpaidAction,
  cancelInvoiceAction,
  sendInvoiceAction,
  type InvoiceStatusState,
  type SendInvoiceState,
} from "@/app/dashboard/finance/invoices/[id]/actions";

const initial: InvoiceStatusState = { error: null, success: false };
const sendInitial: SendInvoiceState = { error: null, message: null };

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
  const [sendState, sendDispatch] = useFormState<SendInvoiceState, FormData>(sendInvoiceAction, sendInitial);

  return (
    <div className="flex gap-2 flex-wrap items-center">
      <button
        type="button"
        onClick={() => window.print()}
        className="h-9 px-3 rounded-lg text-[12px] font-medium text-brand-700 bg-brand-50 hover:bg-brand-100"
      >
        Print / PDF
      </button>

      {/* Send to client — owner picks email, chat, or both. */}
      <form action={sendDispatch} className="flex items-center gap-1.5">
        <input type="hidden" name="invoice_id" value={invoiceId} />
        <select
          name="method"
          defaultValue={clientEmail ? "email" : "chat"}
          aria-label="Send method"
          className="h-9 rounded-lg border border-ink-200 bg-white text-[12px] px-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="email">Email</option>
          <option value="chat">Chat</option>
          <option value="both">Email + Chat</option>
        </select>
        <SendButton />
      </form>
      {sendState.message && (
        <span className="text-[12px] text-emerald-700">{sendState.message}</span>
      )}
      {sendState.error && (
        <span className="text-[12px] text-rose-700">{sendState.error}</span>
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

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-9 px-3 rounded-lg text-[12px] font-medium bg-navy-50 text-navy-800 hover:bg-navy-100 disabled:opacity-50"
    >
      {pending ? "Sending…" : "Send to client"}
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
