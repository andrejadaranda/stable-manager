"use server";

// Server actions for the boarding panel on the horse profile.
// Owner-only writes — RLS plus the service layer enforce this; the
// actions just translate form data + dispatch revalidation.

import { revalidatePath } from "next/cache";
import {
  setHorseMonthlyBoardingFee,
  setHorseBoardingStartDate,
  generateMissingBoardingMonths,
  createCharge,
  deleteCharge,
  markChargePaid,
  markChargeUnpaid,
} from "@/services/boarding";
import { setHorseOwner, setHorseLessonsAvailability } from "@/services/horses";
import { createClient } from "@/services/clients";
import { sendClientInvite } from "@/services/invitations";
import { toFriendlyError } from "@/lib/errors/friendly";

export type BoardingActionState = {
  error: string | null;
  success: boolean;
};

const initial: BoardingActionState = { error: null, success: false };

/** Create a brand-new client, attach them as this horse's owner, and
 *  optionally email them an app invite — all in one step, without leaving
 *  the horse page. The new client also shows up under Clients. */
export async function addNewOwnerAction(
  horseId: string,
  input: { name: string; email: string; sendInvite: boolean },
): Promise<{ error: string | null; invited: boolean; inviteUrl: string | null }> {
  const name = input.name.trim();
  const email = input.email.trim();
  if (!horseId) return { error: "Missing horse id.", invited: false, inviteUrl: null };
  if (!name)    return { error: "Owner name is required.", invited: false, inviteUrl: null };

  try {
    const client = await createClient({
      fullName: name,
      email: email || undefined,
    });
    await setHorseOwner(horseId, client.id);

    let invited = false;
    let inviteUrl: string | null = null;
    if (input.sendInvite && email) {
      // Best-effort — owner stays attached even if the email fails. We
      // always surface the link so the owner can copy/share it manually.
      try {
        const res = await sendClientInvite({ clientId: client.id, email });
        invited = res.emailSent;
        inviteUrl = res.invitation.invite_url ?? null;
      } catch {
        invited = false;
      }
    }
    revalidatePath(`/dashboard/horses/${horseId}`);
    revalidatePath("/dashboard/clients");
    return { error: null, invited, inviteUrl };
  } catch (err) {
    return { error: toFriendlyError(err).message, invited: false, inviteUrl: null };
  }
}

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

/** Set boarding start date + auto-generate one charge per month from then
 *  to now (skipping months already charged). One tap fills the calendar so
 *  the owner can mark each month paid/unpaid. */
export async function setBoardingStartAction(
  horseId: string,
  startDate: string,
): Promise<{ error: string | null; created: number }> {
  if (!horseId) return { error: "Missing horse id.", created: 0 };
  if (!startDate) return { error: "Pick a start date.", created: 0 };
  try {
    await setHorseBoardingStartDate(horseId, startDate);
    const { created } = await generateMissingBoardingMonths(horseId);
    revalidatePath(`/dashboard/horses/${horseId}`);
    return { error: null, created };
  } catch (err) {
    const msg = (err as Error)?.message ?? "";
    if (msg === "NO_MONTHLY_FEE")    return { error: "Set the monthly fee first.", created: 0 };
    if (msg === "HORSE_HAS_NO_OWNER") return { error: "Set an owner client first.", created: 0 };
    return { error: toFriendlyError(err).message, created: 0 };
  }
}

/** Re-run the monthly generation (e.g. a new month rolled over). */
export async function generateBoardingMonthsAction(
  horseId: string,
): Promise<{ error: string | null; created: number }> {
  if (!horseId) return { error: "Missing horse id.", created: 0 };
  try {
    const { created } = await generateMissingBoardingMonths(horseId);
    revalidatePath(`/dashboard/horses/${horseId}`);
    return { error: null, created };
  } catch (err) {
    const msg = (err as Error)?.message ?? "";
    if (msg === "NO_BOARDING_START_DATE") return { error: "Set a boarding start date first.", created: 0 };
    if (msg === "NO_MONTHLY_FEE")         return { error: "Set the monthly fee first.", created: 0 };
    if (msg === "HORSE_HAS_NO_OWNER")     return { error: "Set an owner client first.", created: 0 };
    return { error: toFriendlyError(err).message, created: 0 };
  }
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

  // Optional partial amount — blank / 0 / invalid pays the full remaining.
  const amountRaw = String(formData.get("amount") ?? "").replace(",", ".").trim();
  const amountNum = amountRaw ? Number(amountRaw) : NaN;
  const amount = Number.isFinite(amountNum) && amountNum > 0 ? amountNum : undefined;

  try {
    await markChargePaid(chargeId, method, amount);
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
