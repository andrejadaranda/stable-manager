"use server";

import { revalidatePath } from "next/cache";
import { updateMyHorse } from "@/services/myHorses";
import { toFriendlyError } from "@/lib/errors/friendly";

export type EditMyHorseState = {
  error: string | null;
  success: boolean;
};

const initial: EditMyHorseState = { error: null, success: false };

// Horse-owner-only edit of their own horse. The horses_owner_client_update
// RLS policy + horses_client_field_lock trigger together enforce that
// even if this action's whitelist were bypassed, the DB rejects locked-
// field writes. Keep the action small + readable; the safety lives in
// the database.
export async function editMyHorseAction(
  _prev: EditMyHorseState,
  formData: FormData,
): Promise<EditMyHorseState> {
  const horseId       = String(formData.get("horse_id") ?? "");
  const name          = String(formData.get("name") ?? "").trim();
  const breed         = String(formData.get("breed") ?? "");
  const dateOfBirth   = String(formData.get("date_of_birth") ?? "");
  const notes         = String(formData.get("notes") ?? "");
  const publicBio     = String(formData.get("public_bio") ?? "");

  if (!horseId) return { ...initial, error: "Missing horse id." };
  if (!name)    return { ...initial, error: "Name is required." };

  try {
    await updateMyHorse(horseId, {
      name,
      breed:         breed,
      date_of_birth: dateOfBirth || null,
      notes:         notes,
      public_bio:    publicBio,
    });
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  revalidatePath(`/dashboard/my-horses/${horseId}`);
  revalidatePath("/dashboard/my-horses");
  return { error: null, success: true };
}
