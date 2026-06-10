"use server";

import { revalidatePath } from "next/cache";
import { setInvoiceStatus, sendInvoiceToClient } from "@/services/invoices";

export type InvoiceStatusState = { error: string | null; success: boolean };
const initial: InvoiceStatusState = { error: null, success: false };

export type SendInvoiceState = { error: string | null; message: string | null };

/** Send an invoice to the client via email, chat, or both — owner's choice. */
export async function sendInvoiceAction(
  _p: SendInvoiceState,
  fd: FormData,
): Promise<SendInvoiceState> {
  const id     = String(fd.get("invoice_id") ?? "");
  const method = String(fd.get("method") ?? "email"); // "email" | "chat" | "both"
  if (!id) return { error: "Missing invoice id.", message: null };

  const channels = {
    email: method === "email" || method === "both",
    chat:  method === "chat"  || method === "both",
  };

  try {
    const r = await sendInvoiceToClient(id, channels);
    const parts: string[] = [];
    if (r.emailedTo)  parts.push(`Emailed to ${r.emailedTo}`);
    if (r.chatPosted) parts.push("Posted to chat");
    let message = parts.join(" · ");
    if (r.notes.length) message = (message ? `${message} — ` : "") + r.notes.join(" ");
    return { error: null, message: message || "Nothing was sent." };
  } catch (err) {
    return { error: `Could not send: ${(err as Error)?.message || "unknown error"}.`, message: null };
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
