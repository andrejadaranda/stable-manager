"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  markPaidAction,
  markUnpaidAction,
  cancelInvoiceAction,
  type InvoiceStatusState,
} from "@/app/dashboard/finance/invoices/[id]/actions";

const initial: InvoiceStatusState = { error: null, success: false };

export function InvoiceActions({
  invoiceId,
  status,
}: {
  invoiceId: string;
  status: "issued" | "paid" | "overdue" | "cancelled";
}) {
  const [, paid]      = useFormState<InvoiceStatusState, FormData>(markPaidAction,      initial);
  const [, unpaid]    = useFormState<InvoiceStatusState, FormData>(markUnpaidAction,    initial);
  const [, cancelled] = useFormState<InvoiceStatusState, FormData>(cancelInvoiceAction, initial);

  return (
    <div className="flex gap-2 flex-wrap">
      <button
        type="button"
        onClick={() => window.print()}
        className="h-9 px-3 rounded-lg text-[12px] font-medium text-brand-700 bg-brand-50 hover:bg-brand-100"
      >
        Print / PDF
      </button>

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
