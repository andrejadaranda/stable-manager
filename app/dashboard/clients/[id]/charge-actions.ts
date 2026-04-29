"use server";

import { revalidatePath } from "next/cache";
import {
  createClientCharge,
  deleteClientCharge,
  markClientChargePaid,
  markClientChargeUnpaid,
  type ClientChargeKind,
} from "@/services/clientCharges";
import { toFriendlyError } from "@/lib/errors/friendly";

export type ChargeActionState = {
  error: string | null;
  success: boolean;
};

const initial: ChargeActionState = { error: null, success: false };

const KINDS: ClientChargeKind[] = [
  "farrier",
  "equipment",
  "supplement",
  "vet_copay",
  "transport",
  "training_extra",
  "other",
];

export async function createChargeAction(
  _prev: ChargeActionState,
  formData: FormData,
): Promise<ChargeActionState> {
  const clientId    = String(formData.get("client_id") ?? "");
  const horseId     = String(formData.get("horse_id") ?? "").trim();
  const kindRaw     = String(formData.get("kind") ?? "");
  const customLabel = String(formData.get("custom_label") ?? "").trim();
  const amountRaw   = String(formData.get("amount") ?? "");
  const incurredOn  = String(formData.get("incurred_on") ?? "").trim();
  const notes       = String(formData.get("notes") ?? "").trim();

  if (!clientId) return { ...initial, error: "Missing client id." };
  if (!KINDS.includes(kindRaw as ClientChargeKind)) {
    return { ...initial, error: "Pick a charge type." };
  }

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ...initial, error: "Amount must be a positive number." };
  }

  try {
    await createClientCharge({
      clientId,
      horseId:      horseId || null,
      kind:         kindRaw as ClientChargeKind,
      customLabel:  customLabel || null,
      amount,
      incurredOn:   incurredOn || undefined,
      notes:        notes || null,
    });
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  revalidatePath(`/dashboard/clients/${clientId}`);
  if (horseId) revalidatePath(`/dashboard/horses/${horseId}`);
  return { error: null, success: true };
}

export async function deleteChargeAction(
  _prev: ChargeActionState,
  formData: FormData,
): Promise<ChargeActionState> {
  const id        = String(formData.get("charge_id") ?? "");
  const clientId  = String(formData.get("client_id") ?? "");
  const horseId   = String(formData.get("horse_id") ?? "").trim();
  if (!id) return { ...initial, error: "Missing id." };

  try {
    await deleteClientCharge(id);
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  if (clientId) revalidatePath(`/dashboard/clients/${clientId}`);
  if (horseId)  revalidatePath(`/dashboard/horses/${horseId}`);
  return { error: null, success: true };
}

export async function markPaidAction(
  _prev: ChargeActionState,
  formData: FormData,
): Promise<ChargeActionState> {
  const id        = String(formData.get("charge_id") ?? "");
  const clientId  = String(formData.get("client_id") ?? "");
  const horseId   = String(formData.get("horse_id") ?? "").trim();
  const methodRaw = String(formData.get("method") ?? "cash");
  const method =
    methodRaw === "card" || methodRaw === "transfer" || methodRaw === "other"
      ? methodRaw
      : "cash";
  if (!id) return { ...initial, error: "Missing id." };

  try {
    await markClientChargePaid(id, method);
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  if (clientId) revalidatePath(`/dashboard/clients/${clientId}`);
  if (horseId)  revalidatePath(`/dashboard/horses/${horseId}`);
  return { error: null, success: true };
}

export async function markUnpaidAction(
  _prev: ChargeActionState,
  formData: FormData,
): Promise<ChargeActionState> {
  const id        = String(formData.get("charge_id") ?? "");
  const clientId  = String(formData.get("client_id") ?? "");
  const horseId   = String(formData.get("horse_id") ?? "").trim();
  if (!id) return { ...initial, error: "Missing id." };

  try {
    await markClientChargeUnpaid(id);
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  if (clientId) revalidatePath(`/dashboard/clients/${clientId}`);
  if (horseId)  revalidatePath(`/dashboard/horses/${horseId}`);
  return { error: null, success: true };
}
