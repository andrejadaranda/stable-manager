"use server";

// Bulk-generate boarding charges for a calendar month. Owner-only.

import { revalidatePath } from "next/cache";
import { generateBoardingForMonth } from "@/services/boarding";
import { toFriendlyError } from "@/lib/errors/friendly";

export type GenerateState = {
  error: string | null;
  /** Number of charges actually inserted in the last run. */
  created: number | null;
  /** Number of horses that already had a charge for that month and
   *  were skipped. */
  skipped: number | null;
  /** Sum of inserted amounts. */
  totalAmount: number | null;
};

const initial: GenerateState = {
  error:       null,
  created:     null,
  skipped:     null,
  totalAmount: null,
};

export async function generateBoardingAction(
  _prev: GenerateState,
  formData: FormData,
): Promise<GenerateState> {
  const yearMonth = String(formData.get("year_month") ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    return { ...initial, error: "Pick a valid month." };
  }

  try {
    const r = await generateBoardingForMonth(yearMonth);
    revalidatePath("/dashboard/settings/boarding");
    revalidatePath("/dashboard/horses");
    return {
      error:       null,
      created:     r.created,
      skipped:     r.skipped,
      totalAmount: r.totalAmount,
    };
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }
}
