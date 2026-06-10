"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  fulfillInvoiceRequest,
  dismissInvoiceRequest,
} from "@/services/invoiceRequests";

export type ReqActionState = { error: string | null };
const initial: ReqActionState = { error: null };

export async function fulfillInvoiceRequestAction(
  _p: ReqActionState,
  fd: FormData,
): Promise<ReqActionState> {
  const id = String(fd.get("request_id") ?? "");
  if (!id) return { error: "Missing request id." };

  let invoiceId: string | null = null;
  try {
    invoiceId = await fulfillInvoiceRequest(id);
  } catch (err) {
    const m = (err as Error)?.message ?? "";
    if (m === "NOTHING_TO_INVOICE")
      return { error: "Nothing un-invoiced to bill for this client right now." };
    if (m === "ALREADY_HANDLED")
      return { error: "This request was already handled." };
    return { error: `Could not generate: ${m || "unknown error"}.` };
  }

  revalidatePath("/dashboard/finance/invoices");
  if (invoiceId) redirect(`/dashboard/finance/invoices/${invoiceId}`);
  return initial;
}

export async function dismissInvoiceRequestAction(
  _p: ReqActionState,
  fd: FormData,
): Promise<ReqActionState> {
  const id = String(fd.get("request_id") ?? "");
  if (!id) return { error: "Missing request id." };
  try {
    await dismissInvoiceRequest(id);
  } catch (err) {
    return { error: (err as Error)?.message ?? "Could not dismiss." };
  }
  revalidatePath("/dashboard/finance/invoices");
  return initial;
}
