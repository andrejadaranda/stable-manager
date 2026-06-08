"use server";

import { revalidatePath } from "next/cache";
import { setInvoiceStatus, emailInvoiceToClient } from "@/services/invoices";

export type InvoiceStatusState = { error: string | null; success: boolean };
const initial: InvoiceStatusState = { error: null, success: false };

export type EmailInvoiceState = { error: string | null; sentTo: string | null };

export async function emailInvoiceAction(
  _p: EmailInvoiceState,
  fd: FormData,
): Promise<EmailInvoiceState> {
  const id = String(fd.get("invoice_id") ?? "");
  if (!id) return { error: "Missing invoice id.", sentTo: null };
  try {
    const { sentTo } = await emailInvoiceToClient(id);
    return { error: null, sentTo };
  } catch (err) {
    const m = (err as Error)?.message ?? "";
    if (m === "NO_CLIENT_EMAIL") return { error: "This client has no email on file.", sentTo: null };
    return { error: `Could not send: ${m || "unknown error"}.`, sentTo: null };
  }
}

async function changeStatus(
  invoiceId: string,
  status: "paid" | "issued" | "cancelled",
): Promise<InvoiceStatusState> {
  if (!invoiceId) return { ...initial, error: "Missing invoice id." };
  try {
    await setInvoiceStatus(invoiceId, status);
  } catch (err) {
    return { ...initial, error: (err as Error)?.message ?? "Update failed." };
  }
  revalidatePath(`/dashboard/finance/invoices/${invoiceId}`);
  revalidatePath("/dashboard/finance/invoices");
  return { error: null, success: true };
}

export async function markPaidAction(_p: InvoiceStatusState, fd: FormData): Promise<InvoiceStatusState> {
  return changeStatus(String(fd.get("invoice_id") ?? ""), "paid");
}
export async function markUnpaidAction(_p: InvoiceStatusState, fd: FormData): Promise<InvoiceStatusState> {
  return changeStatus(String(fd.get("invoice_id") ?? ""), "issued");
}
export async function cancelInvoiceAction(_p: InvoiceStatusState, fd: FormData): Promise<InvoiceStatusState> {
  return changeStatus(String(fd.get("invoice_id") ?? ""), "cancelled");
}
