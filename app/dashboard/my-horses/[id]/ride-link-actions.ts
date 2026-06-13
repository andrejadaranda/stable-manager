"use server";

import { revalidatePath } from "next/cache";
import {
  createRideLogLink,
  revokeRideLogLink,
} from "@/services/guestContributors";
import { toFriendlyError } from "@/lib/errors/friendly";

export type RideLinkState = { error: string | null; url: string | null };
const initial: RideLinkState = { error: null, url: null };

export async function createRideLinkAction(
  _p: RideLinkState,
  fd: FormData,
): Promise<RideLinkState> {
  const horseId   = String(fd.get("horse_id") ?? "");
  const riderName = String(fd.get("rider_name") ?? "");
  if (!horseId) return { ...initial, error: "Missing horse." };

  try {
    const tok = await createRideLogLink({ horseId, riderName });
    const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.longrein.eu").replace(/\/+$/, "");
    revalidatePath(`/dashboard/my-horses/${horseId}`);
    return { error: null, url: `${base}/guest/ride/${tok.token}` };
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }
}

export async function revokeRideLinkAction(
  _p: RideLinkState,
  fd: FormData,
): Promise<RideLinkState> {
  const id      = String(fd.get("token_id") ?? "");
  const horseId = String(fd.get("horse_id") ?? "");
  if (!id) return { ...initial, error: "Missing link id." };
  try {
    await revokeRideLogLink(id);
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }
  if (horseId) revalidatePath(`/dashboard/my-horses/${horseId}`);
  return initial;
}
