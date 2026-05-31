"use server";

import { revalidatePath } from "next/cache";
import {
  createBoardingRate,
  updateBoardingRate,
  deleteBoardingRate,
} from "@/services/boardingRates";
import { toFriendlyError } from "@/lib/errors/friendly";

export type RateActionState = { error: string | null; success: boolean };

const initial: RateActionState = { error: null, success: false };

export async function createRateAction(
  _prev: RateActionState,
  formData: FormData,
): Promise<RateActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const amount = Number(String(formData.get("amount") ?? "").trim());
  if (!name) return { ...initial, error: "Name is required." };
  if (!Number.isFinite(amount) || amount < 0) {
    return { ...initial, error: "Amount must be a non-negative number." };
  }
  try {
    await createBoardingRate({ name, amount });
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }
  revalidatePath("/dashboard/settings/boarding");
  return { error: null, success: true };
}

export async function updateRateAction(
  _prev: RateActionState,
  formData: FormData,
): Promise<RateActionState> {
  const id = String(formData.get("rate_id") ?? "");
  if (!id) return { ...initial, error: "Missing rate id." };
  const name = String(formData.get("name") ?? "").trim();
  const amount = Number(String(formData.get("amount") ?? "").trim());
  const active = String(formData.get("active") ?? "true") !== "false";
  if (!name) return { ...initial, error: "Name is required." };
  if (!Number.isFinite(amount) || amount < 0) {
    return { ...initial, error: "Amount must be a non-negative number." };
  }
  try {
    await updateBoardingRate(id, { name, amount, active });
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }
  revalidatePath("/dashboard/settings/boarding");
  return { error: null, success: true };
}

export async function deleteRateAction(
  _prev: RateActionState,
  formData: FormData,
): Promise<RateActionState> {
  const id = String(formData.get("rate_id") ?? "");
  if (!id) return { ...initial, error: "Missing rate id." };
  try {
    await deleteBoardingRate(id);
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }
  revalidatePath("/dashboard/settings/boarding");
  return { error: null, success: true };
}
