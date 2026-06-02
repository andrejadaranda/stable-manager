"use server";

import { revalidatePath } from "next/cache";
import { addPayment, deletePayment, updatePayment } from "@/services/payments";
import { createClient } from "@/services/clients";
import { getBoardingChargeRemaining } from "@/services/boarding";

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
  // When the owner picks a specific unpaid month, link the payment to that
  // charge so the month auto-flips to Paid in horse_boarding_summary.
  const boardingChargeId = String(formData.get("boarding_charge_id") ?? "").trim();

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
    // Guard against overpaying a linked boarding month — it would silently
    // flip the month to "paid" and inflate collected revenue. Validate the
    // amount against the charge's remaining balance server-side (the client
    // input is not authoritative). Partial (amount < remaining) is fine.
    if (purpose === "boarding" && boardingChargeId) {
      const remaining = await getBoardingChargeRemaining(boardingChargeId);
      if (remaining == null) {
        return { error: "That boarding month couldn't be found. Refresh and try again.", success: false };
      }
      if (amount > remaining + 0.005) {
        return {
          error: `That's more than the €${remaining.toFixed(2)} left on this month. Enter €${remaining.toFixed(2)} or less, or record the extra as a general payment.`,
          success: false,
        };
      }
    }

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
      boardingChargeId: purpose === "boarding" && boardingChargeId ? boardingChargeId : null,
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

/** Edit a payment (owner-only): amount, method, date, note. */
export async function updatePaymentAction(
  _prev: AddPaymentState,
  formData: FormData,
): Promise<AddPaymentState> {
  const id = String(formData.get("payment_id") ?? "");
  if (!id) return { error: "Missing payment id.", success: false };
  const amount = Number(String(formData.get("amount") ?? "").trim());
  const paidAt = String(formData.get("paid_at") ?? "");
  const method = String(formData.get("method") ?? "cash");
  const notes  = String(formData.get("notes") ?? "").trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Amount must be a positive number.", success: false };
  }
  const validMethods = ["cash", "card", "transfer", "other"] as const;
  if (!validMethods.includes(method as (typeof validMethods)[number])) {
    return { error: "Invalid payment method.", success: false };
  }

  try {
    await updatePayment({
      id,
      amount,
      method: method as "cash" | "card" | "transfer" | "other",
      paidAt: paidAt || undefined,
      notes: notes || null,
    });
  } catch (err: any) {
    const message = err?.message ?? "";
    if (message === "INVALID_AMOUNT") return { error: "Amount must be a positive number.", success: false };
    return { error: `Could not update payment: ${message || "unknown error"}.`, success: false };
  }

  revalidatePath("/dashboard/payments");
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
