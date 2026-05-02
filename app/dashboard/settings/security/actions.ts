"use server";

import { revalidatePath } from "next/cache";
import {
  enrollTotp,
  verifyEnrollment,
  unenrollFactor,
  type EnrollResult,
} from "@/services/mfa";
import { toFriendlyError } from "@/lib/errors/friendly";

export type EnrollState = {
  error:   string | null;
  enroll:  EnrollResult | null;
};

export async function startEnrollAction(_prev: EnrollState): Promise<EnrollState> {
  try {
    const enroll = await enrollTotp();
    return { error: null, enroll };
  } catch (err) {
    return { error: toFriendlyError(err).message, enroll: null };
  }
}

export type VerifyState = { error: string | null; success: boolean };

export async function verifyEnrollAction(
  _prev: VerifyState,
  fd: FormData,
): Promise<VerifyState> {
  const factorId = String(fd.get("factor_id") ?? "");
  const code     = String(fd.get("code")      ?? "").replace(/\s+/g, "");
  if (!factorId)            return { error: "Missing factor.", success: false };
  if (!/^\d{6}$/.test(code)) return { error: "Enter the 6-digit code from your app.", success: false };
  try {
    await verifyEnrollment(factorId, code);
    revalidatePath("/dashboard/settings/security");
    return { error: null, success: true };
  } catch (err) {
    return { error: toFriendlyError(err).message, success: false };
  }
}

export type UnenrollState = { error: string | null };

export async function unenrollAction(
  _prev: UnenrollState,
  fd: FormData,
): Promise<UnenrollState> {
  const factorId = String(fd.get("factor_id") ?? "");
  if (!factorId) return { error: "Missing factor." };
  try {
    await unenrollFactor(factorId);
    revalidatePath("/dashboard/settings/security");
    return { error: null };
  } catch (err) {
    return { error: toFriendlyError(err).message };
  }
}
