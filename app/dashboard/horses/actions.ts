"use server";

import { revalidatePath } from "next/cache";
import { createHorse, updateHorse } from "@/services/horses";

export type CreateHorseState = { error: string | null; success: boolean };

const initial: CreateHorseState = { error: null, success: false };

export async function createHorseAction(
  _prev: CreateHorseState,
  formData: FormData,
): Promise<CreateHorseState> {
  const name      = String(formData.get("name") ?? "").trim();
  const status    = String(formData.get("status") ?? "active");
  const dailyRaw  = String(formData.get("daily_lesson_limit") ?? "").trim();
  const weeklyRaw = String(formData.get("weekly_lesson_limit") ?? "").trim();
  const notesRaw  = String(formData.get("notes") ?? "").trim();

  if (!name) return { error: "Name is required.", success: false };

  const daily  = dailyRaw  === "" ? 4  : Number(dailyRaw);
  const weekly = weeklyRaw === "" ? 20 : Number(weeklyRaw);
  if (!Number.isFinite(daily)  || daily  < 0) return { error: "Daily limit must be a non-negative number.",  success: false };
  if (!Number.isFinite(weekly) || weekly < 0) return { error: "Weekly limit must be a non-negative number.", success: false };

  try {
    await createHorse({
      name,
      active: status === "active",
      dailyLessonLimit:  daily,
      weeklyLessonLimit: weekly,
      notes: notesRaw || undefined,
    });
  } catch (err: any) {
    const message = err?.message ?? "";
    if (message === "FORBIDDEN")        return { error: "You don't have permission to add horses.", success: false };
    if (message === "UNAUTHENTICATED")  return { error: "Your session expired. Sign in again.",   success: false };
    return { error: `Could not create horse: ${message || "unknown error"}.`, success: false };
  }

  revalidatePath("/dashboard/horses");
  return { error: null, success: true };
}

// =============================================================
// Update an existing horse
// =============================================================
export type UpdateHorseState = { error: string | null; success: boolean };

export async function updateHorseAction(
  _prev: UpdateHorseState,
  formData: FormData,
): Promise<UpdateHorseState> {
  const id        = String(formData.get("horse_id") ?? "");
  const name      = String(formData.get("name") ?? "").trim();
  const status    = String(formData.get("status") ?? "active");
  const dailyRaw  = String(formData.get("daily_lesson_limit") ?? "").trim();
  const weeklyRaw = String(formData.get("weekly_lesson_limit") ?? "").trim();
  const notesRaw  = String(formData.get("notes") ?? "");
  const publicBioRaw = String(formData.get("public_bio") ?? "");
  const photoUrlRaw  = String(formData.get("photo_url") ?? "").trim();
  const bcName     = String(formData.get("backup_contact_name") ?? "").trim();
  const bcPhone    = String(formData.get("backup_contact_phone") ?? "").trim();
  const bcRelation = String(formData.get("backup_contact_relation") ?? "").trim();

  if (!id)   return { error: "Missing horse id.", success: false };
  if (!name) return { error: "Name is required.", success: false };

  const daily  = dailyRaw  === "" ? 0 : Number(dailyRaw);
  const weekly = weeklyRaw === "" ? 0 : Number(weeklyRaw);
  if (!Number.isFinite(daily)  || daily  < 0) return { error: "Daily limit must be a non-negative number.",  success: false };
  if (!Number.isFinite(weekly) || weekly < 0) return { error: "Weekly limit must be a non-negative number.", success: false };

  try {
    await updateHorse(id, {
      name,
      active: status === "active",
      dailyLessonLimit:  daily,
      weeklyLessonLimit: weekly,
      notes: notesRaw.trim() === "" ? null : notesRaw.trim(),
      publicBio: publicBioRaw.trim() === "" ? null : publicBioRaw.trim(),
      photoUrl:  photoUrlRaw === "" ? null : photoUrlRaw,
      backupContactName:     bcName     === "" ? null : bcName,
      backupContactPhone:    bcPhone    === "" ? null : bcPhone,
      backupContactRelation: bcRelation === "" ? null : bcRelation,
    });
  } catch (err: any) {
    const message = err?.message ?? "";
    if (message === "FORBIDDEN")        return { error: "You don't have permission to edit horses.", success: false };
    if (message === "UNAUTHENTICATED")  return { error: "Your session expired. Sign in again.",     success: false };
    return { error: `Could not update horse: ${message || "unknown error"}.`, success: false };
  }

  revalidatePath("/dashboard/horses");
  revalidatePath(`/dashboard/horses/${id}`);
  return { error: null, success: true };
}
