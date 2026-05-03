"use server";

// One-click "mark boarding charge paid" + "undo" actions for the
// Outstanding boarders board. Owner-only.

import { revalidatePath } from "next/cache";
import { markChargePaid, markChargeUnpaid } from "@/services/boarding";
import { toFriendlyError } from "@/lib/errors/friendly";

export type MarkPaidResult = { ok: boolean; error: string | null };

export async function markBoardingPaidAction(
  _prev: MarkPaidResult,
  formData: FormData,
): Promise<MarkPaidResult> {
  const chargeId = String(formData.get("charge_id") ?? "");
  const methodRaw = String(formData.get("method") ?? "cash");
  if (!chargeId) return { ok: false, error: "Missing charge id." };
  const method = (["cash","card","transfer","other"] as const).includes(methodRaw as never)
    ? (methodRaw as "cash" | "card" | "transfer" | "other")
    : "cash";
  try {
    await markChargePaid(chargeId, method);
    revalidatePath("/dashboard/settings/boarding");
    revalidatePath("/dashboard/payments");
    revalidatePath("/dashboard/finance");
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: toFriendlyError(err).message };
  }
}

export async function markBoardingUnpaidAction(
  _prev: MarkPaidResult,
  formData: FormData,
): Promise<MarkPaidResult> {
  const chargeId = String(formData.get("charge_id") ?? "");
  if (!chargeId) return { ok: false, error: "Missing charge id." };
  try {
    await markChargeUnpaid(chargeId);
    revalidatePath("/dashboard/settings/boarding");
    revalidatePath("/dashboard/payments");
    revalidatePath("/dashboard/finance");
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: toFriendlyError(err).message };
  }
}
