"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createLesson,
  createRecurringLessons,
  updateLesson,
  deleteLesson,
  duplicateLesson,
  getLessonChanges,
  type LessonChange,
} from "@/services/lessons";
import { createSessionFromLesson } from "@/services/sessions";
import { addPayment } from "@/services/payments";
import { createClient } from "@/services/clients";
import { createPackage } from "@/services/packages";
import { getSession, requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Looks up an existing client by phone in the caller's stable, or
// creates one. Used by the lesson-create quick-add path so trainers
// don't have to leave the form to onboard a walk-in.
async function ensureClientForQuickAdd(name: string, phone: string): Promise<string> {
  const supabase = createSupabaseServerClient();
  const phoneNorm = phone.replace(/\s+/g, "");
  // Phone is OPTIONAL — trainers often onboard a walk-in before they have
  // a number (the owner fills it in later). Only dedupe by phone when one
  // was actually given; with no phone we always create a fresh client.
  // RLS narrows to caller's stable; phone match is exact-string here
  // because we don't normalise on insert. If we ever standardise to E.164
  // we'd update the lookup at the same time.
  if (phoneNorm) {
    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("phone", phoneNorm)
      .maybeSingle();
    if (existing) return (existing as { id: string }).id;
  }

  const created = await createClient({
    fullName: name.trim(),
    phone:    phoneNorm || undefined,
    active:   true,
  });
  return (created as { id: string }).id;
}

// Group lesson: a paying parent + several children, each with their own
// price. Billed to the parent (lessons.client_id = parent, price = sum) so
// the existing invoicing charges one combined amount; each child becomes a
// participant carrying its own recorded price. New children are created on
// the fly and linked to the parent via guardian_client_id.
async function handleGroupCreate(formData: FormData): Promise<CreateLessonState> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  const supabase = createSupabaseServerClient();

  const trainerId = String(formData.get("trainer_id") ?? "").trim();
  const arenaId   = String(formData.get("arena_id") ?? "").trim();
  const startsAt  = String(formData.get("starts_at") ?? "");
  const endsAt    = String(formData.get("ends_at") ?? "");
  const notes     = String(formData.get("notes") ?? "").trim();

  const payerClientId0 = String(formData.get("payer_client_id") ?? "").trim();
  const payerName      = String(formData.get("payer_name") ?? "").trim();
  const payerPhone     = String(formData.get("payer_phone") ?? "").trim();

  type ChildInput = { name?: string; price?: number | string; existingClientId?: string };
  let raw: ChildInput[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("group_children") ?? "[]"));
    if (Array.isArray(parsed)) raw = parsed as ChildInput[];
  } catch { raw = []; }

  if (!startsAt || !endsAt) return { error: "Start and end times are required.", success: false };
  const startMs = Date.parse(startsAt);
  const endMs   = Date.parse(endsAt);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return { error: "Invalid date format.", success: false };
  if (endMs <= startMs) return { error: "End time must be after start time.", success: false };

  const children = raw
    .map((c) => ({
      name:             (c.name ?? "").trim(),
      existingClientId: (c.existingClientId ?? "").trim(),
      price:            Math.max(0, Number(c.price) || 0),
    }))
    .filter((c) => c.existingClientId || c.name);
  if (children.length === 0) return { error: "Add at least one child to the group.", success: false };

  // Resolve the paying parent — existing client or a new one by name/phone.
  let payerClientId = payerClientId0;
  if (!payerClientId) {
    if (!payerName) return { error: "Add the paying parent's name.", success: false };
    try {
      payerClientId = await ensureClientForQuickAdd(payerName, payerPhone);
    } catch (err: any) {
      return { error: `Couldn't create the parent: ${err?.message ?? "unknown error"}.`, success: false };
    }
  }

  const total = children.reduce((s, c) => s + c.price, 0);

  const { data: lesson, error: lErr } = await supabase
    .from("lessons")
    .insert({
      stable_id:        session.stableId,
      client_id:        payerClientId,
      horse_id:         null,
      trainer_id:       trainerId || null,
      arena_id:         arenaId || null,
      starts_at:        new Date(startMs).toISOString(),
      ends_at:          new Date(endMs).toISOString(),
      price:            total,
      status:           "scheduled",
      notes:            notes || null,
      lesson_type:      "group",
      max_participants: Math.max(children.length, 1),
    })
    .select("id")
    .single();
  if (lErr || !lesson) {
    return { error: `Could not create the group lesson: ${lErr?.message ?? "unknown error"}.`, success: false };
  }
  const lessonId = (lesson as { id: string }).id;

  for (const c of children) {
    let childId = c.existingClientId;
    if (!childId) {
      const { data: cc, error: ccErr } = await supabase
        .from("clients")
        .insert({
          stable_id:            session.stableId,
          full_name:            c.name,
          is_minor:             true,
          guardian_client_id:   payerClientId,
          guardian_name:        payerName || null,
          guardian_phone:       payerPhone || null,
          default_lesson_price: c.price || null,
          active:               true,
        })
        .select("id")
        .single();
      if (ccErr || !cc) continue;
      childId = (cc as { id: string }).id;
    }
    await supabase.from("lesson_participants").insert({
      lesson_id: lessonId,
      client_id: childId,
      horse_id:  null,
      price:     c.price || null,
      status:    "confirmed",
    });
  }

  revalidatePath("/dashboard/calendar");
  return { error: null, success: true };
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
  const arenaRaw   = String(formData.get("arena_id") ?? "").trim();
  const overLimitReason = String(formData.get("over_limit_reason") ?? "").trim();
  const repeatRaw = String(formData.get("repeat_count") ?? "").trim();
  const repeatIntervalRaw = String(formData.get("repeat_interval_weeks") ?? "1").trim();

  // Group-lesson path — a paying parent + several children, each with their
  // own price (some discounted). Billed to the parent (client_id = parent,
  // price = sum) so the existing invoicing bills one combined amount; each
  // child is a participant with its own recorded price. Handled separately
  // from the single-lesson flow below.
  if (String(formData.get("lesson_type") ?? "") === "group") {
    return handleGroupCreate(formData);
  }

  // Quick-add path — trainer typed a new client right in the lesson
  // form. Look them up by phone or create. The returned id replaces
  // the (empty) client_id from the dropdown for the rest of the flow.
  if (!clientId && newClientName) {
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
  // horse_id AND trainer_id are optional — a lesson can be booked before
  // either is assigned ("TBD horse" or "TBD trainer" — common when the
  // weekly trainer rota isn't finalized at booking time). Only client and
  // times are strictly required.
  if (!clientId || !startsAt || !endsAt) {
    return { error: "Client and times are required.", success: false };
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
          arenaId:   arenaRaw || null,
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
      arenaId:   arenaRaw || null,
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

// Sell a package right from the Edit-lesson dialog and cover this lesson
// with it — for when a client decides on the spot to take a subscription
// instead of paying per lesson. Creates the package (logs the upfront
// payment) and moves the lesson onto it (price → €0). Owner-only via
// createPackage's own role check.
export async function sellPackageForLessonAction(
  _prev: UpdateLessonState,
  formData: FormData,
): Promise<UpdateLessonState> {
  const lessonId     = String(formData.get("lesson_id") ?? "");
  const clientId     = String(formData.get("client_id") ?? "");
  const totalLessons = parseInt(String(formData.get("total_lessons") ?? ""), 10);
  const price        = parseFloat(String(formData.get("price") ?? ""));
  // Payment intent chosen by the owner: not paid yet / paid in full / partial.
  const payStatus    = String(formData.get("pay_status") ?? "none"); // none | full | partial
  const methodRaw    = String(formData.get("method") ?? "cash");
  const method       = (["cash", "card", "transfer", "other"].includes(methodRaw) ? methodRaw : "cash") as "cash" | "card" | "transfer" | "other";
  const partialAmt   = parseFloat(String(formData.get("paid_amount") ?? ""));

  if (!lessonId || !clientId) return { error: "Missing lesson or client.", success: false };
  if (!Number.isFinite(totalLessons) || totalLessons <= 0)
    return { error: "Enter how many lessons the package includes.", success: false };
  if (!Number.isFinite(price) || price < 0)
    return { error: "Enter the package price.", success: false };
  if (payStatus === "partial" && (!Number.isFinite(partialAmt) || partialAmt <= 0 || partialAmt >= price))
    return { error: "Enter the partial amount paid (less than the full price).", success: false };

  try {
    const pkg = await createPackage({
      clientId,
      totalLessons,
      price,
      recordPayment: payStatus !== "none",
      paymentMethod: method,
      paidAmount:    payStatus === "partial" ? partialAmt : undefined,
    });
    await updateLesson(lessonId, { packageId: (pkg as { id: string }).id, price: 0 });
  } catch (err: any) {
    const m = err?.message ?? "";
    if (m === "FORBIDDEN") return { error: "Only the owner can sell packages.", success: false };
    return { error: `Could not create the package: ${m || "unknown error"}.`, success: false };
  }

  revalidatePath("/dashboard/calendar");
  return { error: null, success: true };
}

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
  const arenaRaw   = String(formData.get("arena_id") ?? "").trim();
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
  const arenaId =
    arenaRaw === "" ? undefined :
    arenaRaw === "__none__" ? null :
    arenaRaw;

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
      arenaId,
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

export async function duplicateLessonAction(
  _prev: UpdateLessonState,
  formData: FormData,
): Promise<UpdateLessonState> {
  const lessonId = String(formData.get("lesson_id") ?? "");
  if (!lessonId) return { error: "Missing lesson id.", success: false };
  let day: string;
  try {
    const { startsAt } = await duplicateLesson(lessonId);
    day = startsAt.slice(0, 10);
  } catch (err: any) {
    const m = err?.message ?? "";
    if (m === "HORSE_DOUBLE_BOOKED" || m === "HORSE_OR_TRAINER_DOUBLE_BOOKED")
      return { error: "That slot next week is already taken — pick another time.", success: false };
    if (m === "HORSE_OVER_DAILY_LIMIT" || m === "HORSE_OVER_WEEKLY_LIMIT")
      return { error: "That would push the horse over its workload cap next week.", success: false };
    return { error: `Could not book again: ${m || "unknown error"}.`, success: false };
  }
  revalidatePath("/dashboard/calendar");
  redirect(`/dashboard/calendar?date=${day}`);
}

export async function fetchLessonChangesAction(lessonId: string): Promise<LessonChange[]> {
  if (!lessonId) return [];
  try {
    return await getLessonChanges(lessonId);
  } catch {
    return [];
  }
}

export async function deleteLessonAction(
  _prev: UpdateLessonState,
  formData: FormData,
): Promise<UpdateLessonState> {
  const lessonId = String(formData.get("lesson_id") ?? "");
  if (!lessonId) return { error: "Missing lesson id.", success: false };

  try {
    await deleteLesson(lessonId);
  } catch (err: any) {
    const message = err?.message ?? "";
    if (message === "FORBIDDEN")
      return { error: "You don't have permission to delete lessons.", success: false };
    return { error: `Could not delete: ${message || "unknown error"}.`, success: false };
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
