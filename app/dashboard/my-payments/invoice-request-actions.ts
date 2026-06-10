"use server";

import { revalidatePath } from "next/cache";
import {
  createInvoiceRequest,
  cancelInvoiceRequest,
} from "@/services/invoiceRequests";
import { toFriendlyError } from "@/lib/errors/friendly";

export type RequestInvoiceState = { error: string | null; success: boolean };
const initial: RequestInvoiceState = { error: null, success: false };

export async function createInvoiceRequestAction(
  _p: RequestInvoiceState,
  fd: FormData,
): Promise<RequestInvoiceState> {
  const note = String(fd.get("note") ?? "");
  try {
    await createInvoiceRequest(note);
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }
  revalidatePath("/dashboard/my-payments");
  return { error: null, success: true };
}

export async function cancelInvoiceRequestAction(
  _p: RequestInvoiceState,
  fd: FormData,
): Promise<RequestInvoiceState> {
  const id = String(fd.get("request_id") ?? "");
  if (!id) return { ...initial, error: "Missing request id." };
  try {
    await cancelInvoiceRequest(id);
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }
  revalidatePath("/dashboard/my-payments");
  return { error: null, success: true };
}
