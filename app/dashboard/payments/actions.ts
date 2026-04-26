"use server";

import { revalidatePath } from "next/cache";
import { addPayment } from "@/services/payments";

export type AddPaymentState = { error: string | null; success: boolean };

const initial: AddPaymentState = { error: null, success: false };

export async function addPaymentAction(
  _prev: AddPaymentState,
  formData: FormData,
): Promise<AddPaymentState> {
  const clientId  = String(formData.get("client_id") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const paidAt    = String(formData.get("paid_at") ?? "");      // ISO from hidden field
  const lessonId  = String(formData.get("lesson_id") ?? "");
  const method    = String(formData.get("method") ?? "cash");
  const notes     = String(formData.get("notes") ?? "").trim();

  if (!clientId)  return { error: "Client is required.", success: false };
  if (!amountRaw) return { error: "Amount is required.", success: false };
  if (!paidAt)    return { error: "Payment date is required.", success: false };

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Amount must be a positive number.", success: false };
  }

  const validMethods = ["cash", "card", "transfer", "other"] as const;
  if (!validMethods.includes(method as (typeof validMethods)[number])) {
    return { error: "Invalid payment method.", success: false };
  }

  try {
    await addPayment({
      clientId,
      amount,
      method: method as "cash" | "card" | "transfer" | "other",
      lessonId: lessonId || null,
      paidAt,
      notes: notes || undefined,
    });
  } catch (err: any) {
    const message = err?.message ?? "";
    if (message === "FORBIDDEN")        return { error: "Only owners can record payments.",      success: false };
    if (message === "INVALID_AMOUNT")   return { error: "Amount must be a positive number.",     success: false };
    if (message === "UNAUTHENTICATED")  return { error: "Your session expired. Sign in again.",  success: false };
    return { error: `Could not record payment: ${message || "unknown error"}.`, success: false };
  }

  revalidatePath("/dashboard/payments");
  // Detail pages show the same client's balance; bust their cache too.
  revalidatePath("/dashboard/clients", "layout");
  return { error: null, success: true };
}

