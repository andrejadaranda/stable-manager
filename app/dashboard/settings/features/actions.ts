"use server";

import { setStableFeature, FEATURE_KEYS, type FeatureKey } from "@/services/features";
import { toFriendlyError } from "@/lib/errors/friendly";

export type ToggleState = { error: string | null };

export async function toggleFeatureAction(
  _prev: ToggleState,
  fd: FormData,
): Promise<ToggleState> {
  try {
    const rawKey   = String(fd.get("key") ?? "");
    const rawValue = String(fd.get("value") ?? "");
    if (!FEATURE_KEYS.includes(rawKey as FeatureKey)) {
      return { error: "Unknown feature." };
    }
    const value = rawValue === "true";
    await setStableFeature(rawKey as FeatureKey, value);
    return { error: null };
  } catch (err) {
    return { error: toFriendlyError(err).message };
  }
}
