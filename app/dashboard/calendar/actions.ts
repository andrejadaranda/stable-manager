"use server";

import { revalidatePath } from "next/cache";
import {
  createLesson,
  createRecurringLessons,
  updateLesson,
} from "@/services/lessons";
import { createSessionFromLesson } from "@/services/sessions";
import { addPayment } from "@/services/payments";
import { createClient } from "@/services/clients";
import { getSession, requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Looks up an existing client by phone in the caller's stable, or
// creates one. Used by the lesson-create quick-add path so trainers
// don't have to leave the form to onboard a walk-in.
async function ensureClientForQuickAdd(name: string, phone: string): Promise<string> {
  const supabase = createSupabaseServerClient();
  const phoneNorm = phone.replace(/\s+/g, "");
  // RLS narrows to caller's stable; phone match is exact-string here
  // because we don't normalise on insert. If we ever standardise to E.164
  // we'd update the lookup at the same time.
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("phone", phoneNorm)
    .maybeSingle();
  if (existing) return (existing as { id: string }).id;

  const created = await createClient({
    fullName: name.trim(),
    phone:    phoneNorm,
    active:   true,
  });
  return (created as { id: string }).id;
}

export type CreateLessonState = {
  error: string | null;
  success: boolean;
  /** Set when a "Repeat" booking finishes. The form surfaces a
   *  one-line summary (e.g. "Created 10 of 12 — 2 skipped"). */
  summary?: { created: number; skipped: number; reasons?: string[] } | null;
};

const initial: CreateLessonState = { error: null, success: false };

export async function createLessonAction(
  _prev: CreateLessonState,
  formData: FormData,
): Promise<CreateLessonState> {
  const horseId   = String(formData.get("horse_id") ?? "");
  let   clientId  = String(formData.get("client_id") ?? "");
  const trainerId = String(formData.get("trainer_id") ?? "");
  const newClientName  = String(formData.get("new_client_name")  ?? "").trim();
  const newClientPhone = String(formData.get("new_client_phone") ?? "").trim();
  const startsAt  = String(formData.get("starts_at") ?? "");   // ISO
  const endsAt    = String(formData.get("ends_at") ?? "");     // ISO
  const priceRaw  = String(formData.get("price") ?? "").trim();
  const notesRaw  = String(formData.get("notes") ?? "").trim();
  const packageRaw = String(formData.get("package_id") ?? "").trim();
  const serviceRaw = String(formData.get("service_id") ?? "").trim();
  const overLimitReason = String(formData.get("over_limit_reason") ?? "").trim();
  const repeatRaw = String(formData.get("repeat_count") ?? "").trim();
  const repeatIntervalRaw = String(formData.get("repeat_interval_weeks") ?? "1").trim();

  // Quick-add path — trainer typed a new client right in the lesson
  // form. Look them up by phone or create. The returned id replaces
  // the (empty) client_id from the dropdown for the rest of the flow.
  if (!clientId && newClientName && newClientPhone) {
    try {
      clientId = await ensureClientForQuickAdd(newClientName, newClientPhone);
    } catch (err: any) {
      return {
        error: `Couldn't create client: ${err?.message ?? "unknown error"}.`,
        success: false,
      };
    }
  }

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

  // Recurring path: repeat_count > 1 expands into a series. The first
  // lesson uses the supplied start/end; the rest shift by N weeks.
  const repeatCount = Number.parseInt(repeatRaw, 10) || 1;
  const repeatInterval = Math.max(1, Number.parseInt(repeatIntervalRaw, 10) || 1);

  if (repeatCount > 1) {
    try {
      const r = await createRecurringLessons(
        {
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
        },
        { intervalWeeks: repeatInterval, count: repeatCount },
      );

      revalidatePath("/dashboard/calendar");

      if (r.created.length === 0) {
        return {
          error: `Couldn't create any lessons in the series. ${r.skipped[0]?.reason ?? ""}`,
          success: false,
          summary: { created: 0, skipped: r.skipped.length },
        };
      }

      return {
        error: null,
        success: true,
        summary: {
          created: r.created.length,
          skipped: r.skipped.length,
          reasons: r.skipped.map((s) => s.reason).slice(0, 5),
        },
      };
    } catch (err: any) {
      const code = err?.message ?? "";
      if (code === "INVALID_RECURRENCE_COUNT") {
        return { error: "Pick at least 1 occurrence.", success: false };
      }
      if (code === "RECURRENCE_TOO_LONG") {
        return { error: "Series capped at 52 occurrences. Split it across two bookings.", success: false };
      }
      return { error: `Could not create series: ${code || "unknown error"}.`, success: false };
    }
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
