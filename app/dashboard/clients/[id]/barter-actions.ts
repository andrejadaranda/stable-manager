"use server";

import { revalidatePath } from "next/cache";
import { createBarterCredit, deleteBarterCredit } from "@/services/barterCredits";
import { toFriendlyError } from "@/lib/errors/friendly";

export type BarterActionState = { error: string | null; success: boolean };
const initial: BarterActionState = { error: null, success: false };

export async function createBarterAction(
  _prev: BarterActionState,
  formData: FormData,
): Promise<BarterActionState> {
  const clientId    = String(formData.get("client_id") ?? "");
  const entryDate   = String(formData.get("entry_date") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const amountRaw   = String(formData.get("amount") ?? "").replace(",", ".").trim();

  if (!clientId) return { ...initial, error: "Missing client id." };
  if (!description) return { ...initial, error: "Describe the work done." };
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ...initial, error: "Amount must be a positive number." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    return { ...initial, error: "Pick a valid date." };
  }

  try {
    await createBarterCredit({ clientId, entryDate, description, amount });
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  revalidatePath(`/dashboard/clients/${clientId}`);
  return { error: null, success: true };
}

export async function deleteBarterAction(
  _prev: BarterActionState,
  formData: FormData,
): Promise<BarterActionState> {
  const id       = String(formData.get("entry_id") ?? "");
  const clientId = String(formData.get("client_id") ?? "");
  if (!id) return { ...initial, error: "Missing id." };

  try {
    await deleteBarterCredit(id);
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  if (clientId) revalidatePath(`/dashboard/clients/${clientId}`);
  return { error: null, success: true };
}
