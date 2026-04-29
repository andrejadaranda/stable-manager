"use server";

import { revalidatePath } from "next/cache";
import { createLesson, updateLesson } from "@/services/lessons";
import { createSessionFromLesson } from "@/services/sessions";
import { addPayment } from "@/services/payments";
import { getSession, requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  const packageRaw = String(formData.get("package_id") ?? "").trim();
  const serviceRaw = String(formData.get("service_id") ?? "").trim();
  const overLimitReason = String(formData.get("over_limit_reason") ?? "").trim();

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
      packageId: packageRaw || null,
      serviceId: serviceRaw || null,
      overLimitReason: overLimitReason || null,
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
      case "HORSE_OVER_DAILY_LIMIT":
        return {
          error: "This horse has already reached its daily lesson limit. Add a welfare-override reason to proceed.",
          success: false,
        };
      case "HORSE_OVER_WEEKLY_LIMIT":
        return {
          error: "This horse has already reached its weekly lesson limit. Add a welfare-override reason to proceed.",
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
  const packageRaw = String(formData.get("package_id") ?? "").trim();
  const serviceRaw = String(formData.get("service_id") ?? "").trim();
  const overLimitReason = String(formData.get("over_limit_reason") ?? "").trim();
  // "" means "leave unchanged"; "__none__" means "detach package".
  const packageId =
    packageRaw === "" ? undefined :
    packageRaw === "__none__" ? null :
    packageRaw;
  const serviceId =
    serviceRaw === "" ? undefined :
    serviceRaw === "__none__" ? null :
    serviceRaw;

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
      status:    status as LessonStatus,
      startsAt:  new Date(startMs).toISOString(),
      endsAt:    new Date(endMs).toISOString(),
      price,
      notes:     notesRaw.trim() === "" ? null : notesRaw.trim(),
      packageId,
      serviceId,
      overLimitReason: overLimitReason || null,
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
      case "HORSE_OVER_DAILY_LIMIT":
        return {
          error: "Moving this lesson would push the horse over its daily limit. Add a welfare-override reason to proceed.",
          success: false,
        };
      case "HORSE_OVER_WEEKLY_LIMIT":
        return {
          error: "Moving this lesson would push the horse over its weekly limit. Add a welfare-override reason to proceed.",
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

// =============================================================
// Mark a lesson as paid / unpaid (one-click owner action).
//
// "Paid" = create a payments row at the lesson's price, method=cash,
// paid_at=now. "Unpaid" = delete payments tied to this lesson_id.
// Package-covered lessons skip this entirely (their package payment
// is logged separately when the package is created).
// =============================================================
export async function markLessonPaidAction(
  _prev: UpdateLessonState,
  formData: FormData,
): Promise<UpdateLessonState> {
  const lessonId = String(formData.get("lesson_id") ?? "");
  const methodRaw = String(formData.get("method") ?? "cash");
  const method =
    methodRaw === "card" || methodRaw === "transfer" || methodRaw === "other"
      ? methodRaw
      : "cash";
  if (!lessonId) return { error: "Missing lesson id.", success: false };

  try {
    const session = await getSession();
    requireRole(session, "owner");

    const supabase = createSupabaseServerClient();
    const { data: lesson, error: lerr } = await supabase
      .from("lessons")
      .select("id, client_id, price, package_id")
      .eq("id", lessonId)
      .maybeSingle();
    if (lerr || !lesson) {
      return { error: "Lesson not found.", success: false };
    }
    const l = lesson as { id: string; client_id: string; price: number; package_id: string | null };

    if (l.package_id) {
      return { error: "This lesson is covered by a package — no separate payment needed.", success: false };
    }
    if (Number(l.price) <= 0) {
      return { error: "Lesson price is 0 — nothing to mark paid.", success: false };
    }

    await addPayment({
      clientId: l.client_id,
      amount:   Number(l.price),
      method,
      lessonId: l.id,
    });
  } catch (err: any) {
    const message = err?.message ?? "";
    if (message === "FORBIDDEN")
      return { error: "Only owners can record payments.", success: false };
    return { error: `Could not mark paid: ${message || "unknown error"}.`, success: false };
  }

  revalidatePath("/dashboard/calendar");
  return { error: null, success: true };
}

export async function markLessonUnpaidAction(
  _prev: UpdateLessonState,
  formData: FormData,
): Promise<UpdateLessonState> {
  const lessonId = String(formData.get("lesson_id") ?? "");
  if (!lessonId) return { error: "Missing lesson id.", success: false };

  try {
    const session = await getSession();
    requireRole(session, "owner");

    const supabase = createSupabaseServerClient();
    const { error } = await supabase
      .from("payments")
      .delete()
      .eq("lesson_id", lessonId);
    if (error) throw error;
  } catch (err: any) {
    const message = err?.message ?? "";
    if (message === "FORBIDDEN")
      return { error: "Only owners can void payments.", success: false };
    return { error: `Could not undo: ${message || "unknown error"}.`, success: false };
  }

  revalidatePath("/dashboard/calendar");
  return { error: null, success: true };
}
