"use server";

import { revalidatePath } from "next/cache";
import { markUserOnboarded } from "@/services/onboardingTour";

/** Server action — flips profiles.onboarded_at so the welcome tour
 *  doesn't replay on every dashboard visit. Idempotent: replaying
 *  the tour from the help menu calls this again with no harm. */
export async function markOnboardedAction(): Promise<void> {
  await markUserOnboarded();
  revalidatePath("/dashboard", "layout");
}
