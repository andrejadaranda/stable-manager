"use server";

import { revalidatePath } from "next/cache";
import { addPayment, deletePayment } from "@/services/payments";
import { createClient } from "@/services/clients";

export type AddPaymentState = { error: string | null; success: boolean };

const initial: AddPaymentState = { error: null, success: false };

export async function addPaymentAction(
  _prev: AddPaymentState,
  formData: FormData,
): Promise<AddPaymentState> {
  let clientId        = String(formData.get("client_id") ?? "").trim();
  const newClientName = String(formData.get("new_client_name") ?? "").trim();
  const newClientEmail = String(formData.get("new_client_email") ?? "").trim();

  const amountRaw = String(formData.get("amount") ?? "").trim();
  const paidAt    = String(formData.get("paid_at") ?? "");      // ISO from hidden field
  const lessonId  = String(formData.get("lesson_id") ?? "");
  const method    = String(formData.get("method") ?? "cash");
  let   notes     = String(formData.get("notes") ?? "").trim();
  // Boarding context — folded into the note since payments has no horse FK.
  const purpose   = String(formData.get("purpose") ?? "general");
  const horseName = String(formData.get("boarding_horse_name") ?? "").trim();

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

  // Prefix a boarding tag (incl. the horse) onto the note so the purpose
  // is captured even though payments only links to client/lesson.
  if (purpose === "boarding") {
    const tag = horseName ? `Boarding — ${horseName}` : "Boarding";
    notes = notes ? `${tag} · ${notes}` : tag;
  }

  try {
    // Inline new client — create first, then use its id.
    if (!clientId && newClientName) {
      const created = await createClient({
        fullName: newClientName,
        email: newClientEmail || undefined,
      });
      clientId = (created as { id: string }).id;
    }
    if (!clientId) {
      return { error: "Pick a client, or add a new one.", success: false };
    }

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

/** Delete a payment (owner-only). Balance recomputes automatically. */
export async function deletePaymentAction(
  paymentId: string,
): Promise<{ error: string | null }> {
  if (!paymentId) return { error: "Missing payment id." };
  try {
    await deletePayment(paymentId);
  } catch (err) {
    return { error: (err as Error)?.message ?? "Delete failed." };
  }
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/clients", "layout");
  return { error: null };
}
