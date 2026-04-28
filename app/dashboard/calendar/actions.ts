"use server";

import { revalidatePath } from "next/cache";
import { createLesson, updateLesson } from "@/services/lessons";
import { createSessionFromLesson } from "@/services/sessions";

export type CreateLessonState = {
  error: string | null;
  success: boolean;
};

const initial: CreateLessonState = { error: null, success: false };

export async function createLessonAction(
  _prev: CreateLessonState,
  formData: FormData,
): Promise<CreateLessonState> {
  const horseId   = String(formData.get("horse_id") ?? "");
  const clientId  = String(formData.get("client_id") ?? "");
  const trainerId = String(formData.get("trainer_id") ?? "");
  const startsAt  = String(formData.get("starts_at") ?? "");   // ISO
  const endsAt    = String(formData.get("ends_at") ?? "");     // ISO
  const priceRaw  = String(formData.get("price") ?? "").trim();
  const notesRaw  = String(formData.get("notes") ?? "").trim();

  // Field-level validation -----------------------------------------------
  if (!horseId || !clientId || !trainerId || !startsAt || !endsAt) {
    return { error: "All fields except price and notes are required.", success: false };
  }

  const startMs = Date.parse(startsAt);
  const endMs   = Date.parse(endsAt);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return { error: "Invalid date format.", success: false };
  }
  if (endMs <= startMs) {
    return { error: "End time must be after start time.", success: false };
  }

  let price = 0;
  if (priceRaw) {
    const n = Number(priceRaw);
    if (Number.isNaN(n) || n < 0) {
      return { error: "Price must be a non-negative number.", success: false };
    }
    price = n;
  }

  // Service call --------------------------------------------------------
  try {
    await createLesson({
      horseId,
      clientId,
      trainerId,
      startsAt: new Date(startMs).toISOString(),
      endsAt:   new Date(endMs).toISOString(),
      price,
      notes: notesRaw || undefined,
    });
  } catch (err: any) {
    const message = err?.message ?? "";
    switch (message) {
      case "HORSE_DOUBLE_BOOKED":
      case "HORSE_OR_TRAINER_DOUBLE_BOOKED":
        return {
          error: "That time slot conflicts with an existing booking for this horse or trainer.",
          success: false,
        };
      case "INVALID_TIME_RANGE":
        return { error: "End time must be after start time.", success: false };
      case "FORBIDDEN":
        return { error: "You don't have permission to create lessons.", success: false };
      case "UNAUTHENTICATED":
        return { error: "Your session expired. Sign in again.", success: false };
      default:
        return { error: `Could not create lesson: ${message || "unknown error"}.`, success: false };
    }
  }

  revalidatePath("/dashboard/calendar");
  return { error: null, success: true };
}


// =============================================================
// Update / cancel a lesson
// =============================================================
export type UpdateLessonState = { error: string | null; success: boolean };

const VALID_STATUSES = ["scheduled", "completed", "cancelled", "no_show"] as const;
type LessonStatus = (typeof VALID_STATUSES)[number];

export async function updateLessonAction(
  _prev: UpdateLessonState,
  formData: FormData,
): Promise<UpdateLessonState> {
  const lessonId = String(formData.get("lesson_id") ?? "");
  const status   = String(formData.get("status") ?? "");
  const startsAt = String(formData.get("starts_at") ?? "");
  const endsAt   = String(formData.get("ends_at") ?? "");
  const priceRaw = String(formData.get("price") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "");

  if (!lessonId) return { error: "Missing lesson id.", success: false };
  if (!VALID_STATUSES.includes(status as LessonStatus)) {
    return { error: "Invalid status.", success: false };
  }
  if (!startsAt || !endsAt) {
    return { error: "Start and end time are required.", success: false };
  }

  const startMs = Date.parse(startsAt);
  const endMs   = Date.parse(endsAt);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return { error: "Invalid date format.", success: false };
  }
  if (endMs <= startMs) {
    return { error: "End time must be after start time.", success: false };
  }

  let price = 0;
  if (priceRaw !== "") {
    const n = Number(priceRaw);
    if (!Number.isFinite(n) || n < 0) {
      return { error: "Price must be a non-negative number.", success: false };
    }
    price = n;
  }

  try {
    await updateLesson(lessonId, {
      status:   status as LessonStatus,
      startsAt: new Date(startMs).toISOString(),
      endsAt:   new Date(endMs).toISOString(),
      price,
      notes:    notesRaw.trim() === "" ? null : notesRaw.trim(),
    });

    // Auto-log a session when a lesson is marked completed. Best-effort:
    // failures here (e.g. session already exists) must not roll back the
    // lesson update. The trainer can also log additional sessions manually.
    if (status === "completed") {
      await createSessionFromLesson(lessonId).catch(() => {});
      revalidatePath("/dashboard/sessions");
    }
  } catch (err: any) {
    const message = err?.message ?? "";
    switch (message) {
      case "HORSE_DOUBLE_BOOKED":
      case "HORSE_OR_TRAINER_DOUBLE_BOOKED":
        return {
          error:
            "That time slot conflicts with an existing booking for this horse or trainer.",
          success: false,
        };
      case "INVALID_TIME_RANGE":
        return { error: "End time must be after start time.", success: false };
      case "FORBIDDEN":
        return { error: "You don't have permission to edit lessons.", success: false };
      case "UNAUTHENTICATED":
        return { error: "Your session expired. Sign in again.", success: false };
      default:
        return { error: `Could not update lesson: ${message || "unknown error"}.`, success: false };
    }
  }

  revalidatePath("/dashboard/calendar");
  return { error: null, success: true };
}

// Quick "mark cancelled" — used by the side action button in the dialog.
export async function cancelLessonAction(
  _prev: UpdateLessonState,
  formData: FormData,
): Promise<UpdateLessonState> {
  const lessonId = String(formData.get("lesson_id") ?? "");
  if (!lessonId) return { error: "Missing lesson id.", success: false };

  try {
    await updateLesson(lessonId, { status: "cancelled" });
  } catch (err: any) {
    const message = err?.message ?? "";
    if (message === "FORBIDDEN")
      return { error: "You don't have permission to cancel lessons.", success: false };
    return { error: `Could not cancel: ${message || "unknown error"}.`, success: false };
  }

  revalidatePath("/dashboard/calendar");
  return { error: null, success: true };
}
