"use server";

// Server actions for the boarding panel on the horse profile.
// Owner-only writes — RLS plus the service layer enforce this; the
// actions just translate form data + dispatch revalidation.

import { revalidatePath } from "next/cache";
import {
  setHorseMonthlyBoardingFee,
  createCharge,
  deleteCharge,
  markChargePaid,
  markChargeUnpaid,
} from "@/services/boarding";
import { setHorseOwner, setHorseLessonsAvailability } from "@/services/horses";
import { toFriendlyError } from "@/lib/errors/friendly";

export type BoardingActionState = {
  error: string | null;
  success: boolean;
};

const initial: BoardingActionState = { error: null, success: false };

export async function setLessonsAvailabilityAction(
  _prev: BoardingActionState,
  formData: FormData,
): Promise<BoardingActionState> {
  const horseId = String(formData.get("horse_id") ?? "");
  const valueRaw = String(formData.get("available") ?? "false");
  if (!horseId) return { ...initial, error: "Missing horse id." };

  try {
    await setHorseLessonsAvailability(horseId, valueRaw === "true");
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  revalidatePath(`/dashboard/horses/${horseId}`);
  revalidatePath("/dashboard/calendar");
  return { error: null, success: true };
}

export async function setOwnerAction(
  _prev: BoardingActionState,
  formData: FormData,
): Promise<BoardingActionState> {
  const horseId = String(formData.get("horse_id") ?? "");
  const ownerRaw = String(formData.get("owner_client_id") ?? "").trim();
  if (!horseId) return { ...initial, error: "Missing horse id." };

  // Empty string means "clear owner". Sentinel "__none__" also clears.
  const ownerClientId =
    ownerRaw === "" || ownerRaw === "__none__" ? null : ownerRaw;

  try {
    await setHorseOwner(horseId, ownerClientId);
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  revalidatePath(`/dashboard/horses/${horseId}`);
  return { error: null, success: true };
}

export async function setMonthlyFeeAction(
  _prev: BoardingActionState,
  formData: FormData,
): Promise<BoardingActionState> {
  const horseId = String(formData.get("horse_id") ?? "");
  const raw     = String(formData.get("fee") ?? "").trim();
  if (!horseId) return { ...initial, error: "Missing horse id." };

  let fee: number | null = null;
  if (raw !== "") {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      return { ...initial, error: "Fee must be a non-negative number." };
    }
    fee = n;
  }

  try {
    await setHorseMonthlyBoardingFee(horseId, fee);
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  revalidatePath(`/dashboard/horses/${horseId}`);
  return { error: null, success: true };
}

export async function createChargeAction(
  _prev: BoardingActionState,
  formData: FormData,
): Promise<BoardingActionState> {
  const horseId      = String(formData.get("horse_id") ?? "");
  const periodStart  = String(formData.get("period_start") ?? "");
  const periodEnd    = String(formData.get("period_end") ?? "");
  const periodLabel  = String(formData.get("period_label") ?? "").trim();
  const amountRaw    = String(formData.get("amount") ?? "");
  const notes        = String(formData.get("notes") ?? "").trim();

  if (!horseId)     return { ...initial, error: "Missing horse id." };
  if (!periodStart) return { ...initial, error: "Period start is required." };
  if (!periodEnd)   return { ...initial, error: "Period end is required." };

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ...initial, error: "Amount must be a non-negative number." };
  }

  if (new Date(periodEnd) < new Date(periodStart)) {
    return { ...initial, error: "Period end must be after period start." };
  }

  try {
    await createCharge({
      horseId,
      periodStart,
      periodEnd,
      periodLabel: periodLabel || null,
      amount,
      notes: notes || null,
    });
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  revalidatePath(`/dashboard/horses/${horseId}`);
  return { error: null, success: true };
}

export async function deleteChargeAction(
  _prev: BoardingActionState,
  formData: FormData,
): Promise<BoardingActionState> {
  const chargeId = String(formData.get("charge_id") ?? "");
  const horseId  = String(formData.get("horse_id")  ?? "");
  if (!chargeId) return { ...initial, error: "Missing charge id." };

  try {
    await deleteCharge(chargeId);
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  if (horseId) revalidatePath(`/dashboard/horses/${horseId}`);
  return { error: null, success: true };
}

export async function markChargePaidAction(
  _prev: BoardingActionState,
  formData: FormData,
): Promise<BoardingActionState> {
  const chargeId  = String(formData.get("charge_id") ?? "");
  const horseId   = String(formData.get("horse_id")  ?? "");
  const methodRaw = String(formData.get("method") ?? "cash");
  const method =
    methodRaw === "card" || methodRaw === "transfer" || methodRaw === "other"
      ? methodRaw
      : "cash";
  if (!chargeId) return { ...initial, error: "Missing charge id." };

  try {
    await markChargePaid(chargeId, method);
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  if (horseId) revalidatePath(`/dashboard/horses/${horseId}`);
  return { error: null, success: true };
}

export async function markChargeUnpaidAction(
  _prev: BoardingActionState,
  formData: FormData,
): Promise<BoardingActionState> {
  const chargeId = String(formData.get("charge_id") ?? "");
  const horseId  = String(formData.get("horse_id")  ?? "");
  if (!chargeId) return { ...initial, error: "Missing charge id." };

  try {
    await markChargeUnpaid(chargeId);
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  if (horseId) revalidatePath(`/dashboard/horses/${horseId}`);
  return { error: null, success: true };
}
