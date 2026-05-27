"use server";

import { revalidatePath } from "next/cache";
import { createHorse, updateHorse } from "@/services/horses";

export type CreateHorseState = { error: string | null; success: boolean };

const initial: CreateHorseState = { error: null, success: false };

export async function createHorseAction(
  _prev: CreateHorseState,
  formData: FormData,
): Promise<CreateHorseState> {
  const name        = String(formData.get("name") ?? "").trim();
  const breedRaw    = String(formData.get("breed") ?? "").trim();
  const dobRaw      = String(formData.get("date_of_birth") ?? "").trim();
  const ownerRaw    = String(formData.get("owner_client_id") ?? "").trim();
  const photoUrlRaw = String(formData.get("photo_url") ?? "").trim();
  const status      = String(formData.get("status") ?? "active");
  const dailyRaw    = String(formData.get("daily_lesson_limit") ?? "").trim();
  const weeklyRaw   = String(formData.get("weekly_lesson_limit") ?? "").trim();
  const notesRaw    = String(formData.get("notes") ?? "").trim();

  if (!name) return { error: "Name is required.", success: false };

  const daily  = dailyRaw  === "" ? 4  : Number(dailyRaw);
  const weekly = weeklyRaw === "" ? 20 : Number(weeklyRaw);
  if (!Number.isFinite(daily)  || daily  < 0) return { error: "Daily limit must be a non-negative number.",  success: false };
  if (!Number.isFinite(weekly) || weekly < 0) return { error: "Weekly limit must be a non-negative number.", success: false };

  // date_of_birth: optional, must be a sane date if provided.
  if (dobRaw !== "") {
    const d = new Date(dobRaw);
    if (Number.isNaN(d.getTime())) {
      return { error: "Date of birth is invalid.", success: false };
    }
    if (d.getTime() > Date.now()) {
      return { error: "Date of birth can't be in the future.", success: false };
    }
  }

  try {
    await createHorse({
      name,
      breed: breedRaw || undefined,
      dateOfBirth: dobRaw || undefined,
      active: status === "active",
      dailyLessonLimit:  daily,
      weeklyLessonLimit: weekly,
      notes: notesRaw || undefined,
      ownerClientId: ownerRaw || null,
      photoUrl: photoUrlRaw || null,
    });
  } catch (err: any) {
    const message = err?.message ?? "";
    if (message === "FORBIDDEN")        return { error: "You don't have permission to add horses.", success: false };
    if (message === "UNAUTHENTICATED")  return { error: "Your session expired. Sign in again.",   success: false };
    if (message.startsWith("HORSE_CAP_REACHED")) {
      return { error: "You've hit your plan's horse limit. Upgrade to add more.", success: false };
    }
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
  const colorRaw   = String(formData.get("color") ?? "").trim();
  const sexRaw     = String(formData.get("sex") ?? "").trim();
  const uniqueRaw  = String(formData.get("unique_number") ?? "").trim();
  // Sprint 3b — bio expansion
  const microchipRaw = String(formData.get("microchip_id") ?? "").trim();
  const passportRaw  = String(formData.get("passport_no")  ?? "").trim();
  const feiRaw       = String(formData.get("fei_id")       ?? "").trim();
  const sireRaw      = String(formData.get("sire_name")    ?? "").trim();
  const damRaw       = String(formData.get("dam_name")     ?? "").trim();
  const heightHandsRaw = String(formData.get("height_hands") ?? "").trim();
  const disciplineRaw  = String(formData.get("discipline")   ?? "").trim();

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
      color:        colorRaw  === "" ? null : colorRaw,
      sex:          (["mare","gelding","stallion","colt","filly"] as const).includes(sexRaw as never) ? (sexRaw as "mare"|"gelding"|"stallion"|"colt"|"filly") : null,
      uniqueNumber: uniqueRaw === "" ? null : uniqueRaw,
      // Sprint 3b — new bio columns (migration 53). Height lives in `height_hands`.

      microchipId:  microchipRaw === "" ? null : microchipRaw,
      passportNo:   passportRaw  === "" ? null : passportRaw,
      feiId:        feiRaw       === "" ? null : feiRaw,
      sireName:     sireRaw      === "" ? null : sireRaw,
      damName:      damRaw       === "" ? null : damRaw,
      heightHands:  heightHandsRaw === "" ? null : (Number.isFinite(Number(heightHandsRaw)) ? Number(heightHandsRaw) : null),
      discipline:   disciplineRaw  === "" ? null : disciplineRaw,
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
