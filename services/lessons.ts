// Lessons service — central calendar logic.
// RLS handles tenant isolation; service layer adds role gates and
// translates Postgres exclusion-constraint errors to domain errors.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";
import { getHorseWorkloadStatus } from "@/services/horses";

export type CreateLessonInput = {
  /** The horse for this lesson. Optional — a lesson can be booked
   *  before the horse is assigned ("TBD horse"). When null/empty, the
   *  double-booking preflight and welfare cap check are both skipped. */
  horseId?: string | null;
  clientId: string;
  /** Arena assignment. Optional — null = TBD arena. Migration 63. */
  arenaId?: string | null;
  /** Trainer for this lesson. Optional — a lesson can be booked before
   *  the weekly trainer rota is set ("TBD trainer"). When null/empty,
   *  the trainer-double-booking preflight check is skipped. */
  trainerId?: string | null;
  startsAt: string;    // ISO timestamp
  endsAt: string;      // ISO timestamp
  price?: number;
  notes?: string;
  /** Optional package this lesson is drawn from. When set, price is
   *  typically 0 because the package payment was made up front. */
  packageId?: string | null;
  /** Optional service from the stable's price list. Just a label
   *  link — the price still lives on the lesson row. */
  serviceId?: string | null;
  /** When the booking would push the horse over its daily/weekly cap,
   *  the trainer must supply a reason to override. Saved verbatim on
   *  the lesson row for audit. */
  overLimitReason?: string | null;
  /** Shared series uuid linking sibling lessons in a recurring booking.
   *  Set automatically by createRecurringLessons; ignored for one-offs. */
  seriesId?: string | null;
};

// Re-export so callers don't have to know that workload status lives
// in services/horses.ts. Keeps lesson-creation surface self-contained.
export type { HorseWorkloadStatus as WorkloadStatus } from "@/services/horses";

/** Recurring-series result. The first lesson is the "master"; the rest
 *  are siblings on the same weekday + time, expanded forward. Skipped
 *  entries record why each one didn't make it (so the UI can show a
 *  summary like "Created 10 of 12 — 2 skipped due to conflicts"). */
export type RecurringCreateResult = {
  created: Array<{ id: string; startsAt: string }>;
  skipped: Array<{ startsAt: string; reason: string }>;
};

/** Bulk-create N weekly instances of a lesson. The first instance uses
 *  `startsAt`/`endsAt`; each subsequent instance shifts by `intervalWeeks`.
 *  Each instance is checked individually — conflicts (double-booking or
 *  welfare cap) skip THAT instance only and continue. Returns a per-row
 *  summary so the UI can report "10 of 12 created". */
export async function createRecurringLessons(
  base: CreateLessonInput,
  opts: {
    /** Weekly interval. 1 = every week, 2 = every 2 weeks. */
    intervalWeeks?: number;
    /** Number of total lessons to create (including the first). */
    count: number;
  },
): Promise<RecurringCreateResult> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  void session;

  if (opts.count < 1)  throw new Error("INVALID_RECURRENCE_COUNT");
  if (opts.count > 52) throw new Error("RECURRENCE_TOO_LONG"); // sanity cap
  const interval = Math.max(1, opts.intervalWeeks ?? 1);

  // One series_id shared across all created rows. Generate client-side
  // so we can stamp every insert before the round-trip — no need for
  // a second UPDATE pass.
  const seriesId = (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const result: RecurringCreateResult = { created: [], skipped: [] };

  for (let i = 0; i < opts.count; i++) {
    const offset = i * interval * 7 * 86_400_000;
    const startsAt = new Date(new Date(base.startsAt).getTime() + offset).toISOString();
    const endsAt   = new Date(new Date(base.endsAt).getTime()   + offset).toISOString();

    try {
      const created = await createLesson({ ...base, startsAt, endsAt, seriesId });
      result.created.push({ id: (created as { id: string }).id, startsAt });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      result.skipped.push({ startsAt, reason: message });
    }
  }

  return result;
}

// Owner + employee can create lessons.
export async function createLesson(input: CreateLessonInput) {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  if (new Date(input.endsAt) <= new Date(input.startsAt)) {
    throw new Error("INVALID_TIME_RANGE");
  }

  const supabase = createSupabaseServerClient();

  // Normalise: empty string from a form select means "no horse yet".
  const horseId = input.horseId && input.horseId.trim() ? input.horseId.trim() : null;
  const reason = (input.overLimitReason ?? "").trim();

  // Horse-specific checks only run when a horse is assigned. A
  // TBD-horse lesson can't double-book or overwork a horse that
  // isn't picked yet — both checks are skipped.
  if (horseId) {
    // Friendly preflight against the exclusion constraint.
    const { data: free } = await supabase.rpc("check_horse_available", {
      p_horse_id: horseId,
      p_starts_at: input.startsAt,
      p_ends_at: input.endsAt,
      p_exclude_lesson: null,
    });
    if (free === false) throw new Error("HORSE_DOUBLE_BOOKED");

    // Welfare check: would adding this lesson push the horse over its
    // daily or weekly cap? horse_is_overworked() returns the *current*
    // counts on the supplied date, so we compare with-this-lesson-added.
    if (!reason) {
      const status = await getHorseWorkloadStatus(
        horseId,
        input.startsAt.slice(0, 10),
      );
      // After-this-lesson counts: existing + 1.
      if (status.dailyCount + 1 > status.dailyLimit) {
        throw new Error("HORSE_OVER_DAILY_LIMIT");
      }
      if (status.weeklyCount + 1 > status.weeklyLimit) {
        throw new Error("HORSE_OVER_WEEKLY_LIMIT");
      }
    }
  }

  // If a package is supplied, validate it belongs to the same client
  // and still has remaining capacity. The DB trigger will catch
  // cross-client / cross-stable misuse, but we want a friendly error.
  if (input.packageId) {
    const { data: pkg } = await supabase
      .from("lesson_package_summary")
      .select("client_id, lessons_remaining, is_expired")
      .eq("id", input.packageId)
      .maybeSingle();
    if (!pkg) throw new Error("PACKAGE_NOT_FOUND");
    const p = pkg as { client_id: string; lessons_remaining: number; is_expired: boolean };
    if (p.client_id !== input.clientId) throw new Error("PACKAGE_WRONG_CLIENT");
    if (p.is_expired)                   throw new Error("PACKAGE_EXPIRED");
    if (p.lessons_remaining <= 0)       throw new Error("PACKAGE_EXHAUSTED");
  }

  const { data, error } = await supabase
    .from("lessons")
    .insert({
      stable_id: session.stableId,         // RLS WITH CHECK validates this
      horse_id: horseId,                   // null = TBD horse, assigned later
      client_id: input.clientId,
      // null = TBD trainer, assigned later (mirrors horse_id pattern)
      trainer_id: input.trainerId && input.trainerId.trim() ? input.trainerId : null,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      price: input.price ?? 0,
      notes: input.notes ?? null,
      package_id: input.packageId ?? null,
      service_id: input.serviceId ?? null,
      arena_id:   input.arenaId ?? null,    // migration 63
      over_limit_reason: reason || null,
      series_id: input.seriesId ?? null,
    })
    .select()
    .single();

  if (error) {
    // 23P01 = exclusion_violation: caught here if a race beat the preflight
    if (error.code === "23P01") throw new Error("HORSE_OR_TRAINER_DOUBLE_BOOKED");
    throw error;
  }

  // Mirror the lesson into lesson_participants as a 1-rider entry.
  // Group lessons (max_participants > 1) get extra participants added
  // separately via addLessonParticipant. We skip the mirror when horse
  // is TBD because lesson_participants.horse_id is NOT NULL — the row
  // is created later when both client + horse are confirmed.
  if (data && horseId) {
    await supabase.from("lesson_participants").insert({
      lesson_id: data.id,
      client_id: input.clientId,
      horse_id:  horseId,
      status:    "confirmed",
    }).then((res) => {
      // Don't fail the lesson creation if the mirror insert fails — the
      // lesson itself (with client_id + horse_id) is still the source of
      // truth for individual lessons. Log + continue.
      if (res.error) console.warn("[lessons] participant mirror failed:", res.error.message);
    });
  }

  return data;
}

// ---------------------------------------------------------------------------
// GROUP LESSONS — participants management
// ---------------------------------------------------------------------------

/** Add a rider+horse pair to an existing lesson. When the lesson is at
 *  capacity:
 *   - if forceWaitlist (or auto-detect by caller): row is inserted with
 *     status='waitlist' instead of failing.
 *   - otherwise: returns {ok:false, reason:'LESSON_FULL'} so the caller
 *     can ask the user "Join waitlist?" interactively.
 *  Sprint 6 #4 adds the waitlist path. */
export async function addLessonParticipant(
  lessonId: string,
  clientId: string,
  horseId:  string,
  opts: { forceWaitlist?: boolean } = {},
): Promise<{ ok: true; status: "confirmed" | "waitlist" } | { ok: false; reason: string }> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  void session;

  const supabase = createSupabaseServerClient();

  // Capacity check.
  const { data: lesson } = await supabase
    .from("lessons")
    .select("max_participants")
    .eq("id", lessonId)
    .single();

  if (!lesson) return { ok: false, reason: "LESSON_NOT_FOUND" };

  const { count } = await supabase
    .from("lesson_participants")
    .select("client_id", { count: "exact", head: true })
    .eq("lesson_id", lessonId)
    .eq("status", "confirmed");

  const isFull = (count ?? 0) >= (lesson.max_participants ?? 1);
  if (isFull && !opts.forceWaitlist) {
    return { ok: false, reason: "LESSON_FULL" };
  }

  const status = isFull || opts.forceWaitlist ? "waitlist" : "confirmed";

  const { error } = await supabase.from("lesson_participants").insert({
    lesson_id: lessonId,
    client_id: clientId,
    horse_id:  horseId,
    status,
  });

  if (error) {
    if (error.code === "23P01") return { ok: false, reason: "HORSE_DOUBLE_BOOKED" };
    if (error.code === "23505") return { ok: false, reason: "CLIENT_ALREADY_IN_LESSON" };
    return { ok: false, reason: error.message };
  }

  return { ok: true, status };
}

/** Promote a waitlisted rider to confirmed. Capacity is re-checked; if
 *  the lesson is still full, the call is refused. */
export async function promoteFromWaitlist(
  lessonId: string,
  clientId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  void session;

  const supabase = createSupabaseServerClient();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("max_participants")
    .eq("id", lessonId)
    .single();
  if (!lesson) return { ok: false, reason: "LESSON_NOT_FOUND" };

  const { count } = await supabase
    .from("lesson_participants")
    .select("client_id", { count: "exact", head: true })
    .eq("lesson_id", lessonId)
    .eq("status", "confirmed");

  if ((count ?? 0) >= (lesson.max_participants ?? 1)) {
    return { ok: false, reason: "LESSON_FULL" };
  }

  const { error } = await supabase
    .from("lesson_participants")
    .update({ status: "confirmed" })
    .eq("lesson_id", lessonId)
    .eq("client_id", clientId)
    .eq("status", "waitlist");

  if (error) {
    if (error.code === "23P01") return { ok: false, reason: "HORSE_DOUBLE_BOOKED" };
    return { ok: false, reason: error.message };
  }
  return { ok: true };
}

/** Remove a rider from a lesson. The last participant cannot be removed
 *  — the caller should delete the whole lesson instead. */
export async function removeLessonParticipant(
  lessonId: string,
  clientId: string,
): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  void session;

  const supabase = createSupabaseServerClient();

  const { count } = await supabase
    .from("lesson_participants")
    .select("client_id", { count: "exact", head: true })
    .eq("lesson_id", lessonId);

  if ((count ?? 0) <= 1) {
    throw new Error("CANNOT_REMOVE_LAST_PARTICIPANT");
  }

  const { error } = await supabase
    .from("lesson_participants")
    .delete()
    .eq("lesson_id", lessonId)
    .eq("client_id", clientId);

  if (error) throw error;
}

/** Promote a lesson to "group" by raising max_participants. */
export async function setLessonCapacity(
  lessonId: string,
  maxParticipants: number,
): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  void session;

  if (maxParticipants < 1 || maxParticipants > 20) {
    throw new Error("INVALID_CAPACITY");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("lessons")
    .update({
      max_participants: maxParticipants,
      lesson_type:      maxParticipants > 1 ? "group" : "individual",
    })
    .eq("id", lessonId);

  if (error) throw error;
}

/** List participants of a lesson, joined with rider + horse names. */
export async function listLessonParticipants(lessonId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("lesson_participants")
    .select(`
      client_id,
      horse_id,
      status,
      no_show,
      joined_at,
      price,
      clients:client_id ( id, full_name ),
      horses:horse_id   ( id, name )
    `)
    .eq("lesson_id", lessonId)
    .order("joined_at");

  if (error) throw error;
  return data ?? [];
}

/** Set one participant's price (per-child pricing in a group lesson) and,
 *  for a group lesson, re-sum the lesson total so the parent's single bill
 *  (lessons.client_id + lessons.price) stays correct. Single/private lessons
 *  keep their own price untouched. */
export async function setLessonParticipantPrice(
  lessonId: string,
  clientId: string,
  price: number,
): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  void session;
  if (!Number.isFinite(price) || price < 0) throw new Error("INVALID_PRICE");

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("lesson_participants")
    .update({ price })
    .eq("lesson_id", lessonId)
    .eq("client_id", clientId);
  if (error) throw error;

  const { data: lesson } = await supabase
    .from("lessons")
    .select("max_participants")
    .eq("id", lessonId)
    .single();
  if ((lesson?.max_participants ?? 1) > 1) {
    const { data: parts } = await supabase
      .from("lesson_participants")
      .select("price")
      .eq("lesson_id", lessonId);
    const total = ((parts ?? []) as Array<{ price: number | null }>)
      .reduce((s, p) => s + (Number(p.price) || 0), 0);
    await supabase.from("lessons").update({ price: total }).eq("id", lessonId);
  }
}

// Owner + employee.
export async function updateLessonStatus(
  lessonId: string,
  status: "scheduled" | "completed" | "cancelled" | "no_show",
) {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("lessons")
    .update({ status })
    .eq("id", lessonId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// SUBSTITUTE TRAINER — bulk reassign scheduled lessons from A to B.
// Used when a trainer is sick / on holiday and another trainer covers their
// roster for a window. Only `scheduled` lessons are moved; completed ones
// stay attached to whoever ran them. trainer_id exclusion constraint catches
// any conflicts where the substitute already has a lesson at that time.
// ---------------------------------------------------------------------------

export type ReassignResult = {
  reassigned: number;
  skipped:    Array<{ lesson_id: string; starts_at: string; reason: string }>;
};

export async function bulkReassignTrainer(
  fromTrainerId: string,
  toTrainerId:   string,
  periodStart:   string,    // ISO
  periodEnd:     string,    // ISO
): Promise<ReassignResult> {
  const session = await getSession();
  requireRole(session, "owner");
  void session;

  if (fromTrainerId === toTrainerId) {
    throw new Error("SAME_TRAINER");
  }

  const supabase = createSupabaseServerClient();

  const { data: lessons, error } = await supabase
    .from("lessons")
    .select("id, starts_at")
    .eq("trainer_id", fromTrainerId)
    .eq("status", "scheduled")
    .gte("starts_at", periodStart)
    .lte("starts_at", periodEnd)
    .order("starts_at");
  if (error) throw error;

  const result: ReassignResult = { reassigned: 0, skipped: [] };
  for (const lRaw of lessons ?? []) {
    const l = lRaw as { id: string; starts_at: string };
    const { error: updErr } = await supabase
      .from("lessons")
      .update({ trainer_id: toTrainerId })
      .eq("id", l.id);
    if (updErr) {
      // 23P01 = exclusion violation — substitute is already busy at that time.
      const reason =
        updErr.code === "23P01" ? "Substitute has a conflicting lesson" :
        updErr.message ?? "Update failed";
      result.skipped.push({ lesson_id: l.id, starts_at: l.starts_at, reason });
    } else {
      result.reassigned += 1;
    }
  }

  return result;
}

// Owner + employee. Edit any of: status / time window / price / notes.
// Time changes get a horse-availability preflight to surface friendly
// errors before hitting the exclusion constraint.
export type UpdateLessonInput = {
  status?: "scheduled" | "completed" | "cancelled" | "no_show";
  startsAt?: string;
  endsAt?: string;
  price?: number;
  notes?: string | null;
  /** Pass `null` to detach a previously assigned package. */
  packageId?: string | null;
  /** Pass `null` to clear the service link. */
  serviceId?: string | null;
  /** Pass `null` to clear arena assignment. Migration 63. */
  arenaId?: string | null;
  /** When moving a lesson into a day that pushes the horse over its
   *  cap, the trainer must supply a reason. Saved verbatim. */
  overLimitReason?: string | null;
};

export type LessonChange = { id: string; summary: string; created_at: string };

/** Human-readable change history for one lesson (most recent first). */
export async function getLessonChanges(lessonId: string): Promise<LessonChange[]> {
  await getSession();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("lesson_changes")
    .select("id, summary, created_at")
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as LessonChange[];
}

// Diff old vs new lesson and record a readable line per change.
async function logLessonChanges(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  lessonId: string,
  stableId: string,
  userId: string,
  before: { starts_at: string; ends_at: string; status: string; price: number | null },
  after:  { starts_at: string; ends_at: string; status: string; price: number | null },
): Promise<void> {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const lines: string[] = [];
  if (before.starts_at !== after.starts_at || before.ends_at !== after.ends_at) {
    lines.push(`Time moved: ${fmt(before.starts_at)} → ${fmt(after.starts_at)}`);
  }
  if (before.status !== after.status) lines.push(`Status: ${before.status} → ${after.status}`);
  if (Number(before.price ?? 0) !== Number(after.price ?? 0)) {
    lines.push(`Price: €${Number(before.price ?? 0).toFixed(2)} → €${Number(after.price ?? 0).toFixed(2)}`);
  }
  if (lines.length === 0) return;
  await supabase.from("lesson_changes").insert(
    lines.map((summary) => ({ lesson_id: lessonId, stable_id: stableId, changed_by: userId, summary })),
  );
}

/** "Book again" — clone a lesson to the same weekday/time next week
 *  (same client, horse, trainer, service, arena, price). Returns the new
 *  lesson's start so the UI can jump to it. Staff only. */
export async function duplicateLesson(lessonId: string): Promise<{ id: string; startsAt: string }> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  const supabase = createSupabaseServerClient();
  const { data: l } = await supabase
    .from("lessons")
    .select("client_id, horse_id, trainer_id, service_id, arena_id, price, starts_at, ends_at")
    .eq("id", lessonId)
    .maybeSingle();
  if (!l) throw new Error("LESSON_NOT_FOUND");
  const row = l as {
    client_id: string; horse_id: string | null; trainer_id: string | null;
    service_id: string | null; arena_id: string | null; price: number | null;
    starts_at: string; ends_at: string;
  };
  const plusWeek = (iso: string) => new Date(new Date(iso).getTime() + 7 * 24 * 3600 * 1000).toISOString();
  const startsAt = plusWeek(row.starts_at);
  const created = await createLesson({
    clientId:  row.client_id,
    horseId:   row.horse_id ?? null,
    trainerId: row.trainer_id ?? null,
    serviceId: row.service_id ?? null,
    arenaId:   row.arena_id ?? null,
    price:     row.price ?? undefined,
    startsAt,
    endsAt:    plusWeek(row.ends_at),
  });
  return { id: (created as { id: string }).id, startsAt };
}

/** Permanently delete a lesson and its participants. Staff only. Use for
 *  mistakes/duplicates; for a lesson that genuinely happened-but-didn't,
 *  prefer "Mark cancelled" (keeps the record). */
export async function deleteLesson(lessonId: string): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  const supabase = createSupabaseServerClient();
  // Clear participants first in case the FK isn't ON DELETE CASCADE.
  await supabase.from("lesson_participants").delete().eq("lesson_id", lessonId);
  const { error } = await supabase.from("lessons").delete().eq("id", lessonId);
  if (error) throw error;
}

export async function updateLesson(lessonId: string, input: UpdateLessonInput) {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();

  if (input.startsAt && input.endsAt) {
    if (new Date(input.endsAt) <= new Date(input.startsAt)) {
      throw new Error("INVALID_TIME_RANGE");
    }
    // Preflight: skip when caller is moving the lesson to a non-blocking
    // status (cancelled / no_show) since the exclusion constraint
    // ignores those rows anyway.
    const willBlock =
      input.status === undefined || input.status === "scheduled" || input.status === "completed";
    if (willBlock) {
      const { data: existing } = await supabase
        .from("lessons")
        .select("horse_id")
        .eq("id", lessonId)
        .maybeSingle();
      // Only check horse availability when the lesson actually has a
      // horse — a TBD-horse lesson can't double-book anything.
      const exHorseId = (existing as { horse_id: string | null } | null)?.horse_id ?? null;
      if (existing && exHorseId) {
        const { data: free } = await supabase.rpc("check_horse_available", {
          p_horse_id:        exHorseId,
          p_starts_at:       input.startsAt,
          p_ends_at:         input.endsAt,
          p_exclude_lesson:  lessonId,
        });
        if (free === false) throw new Error("HORSE_DOUBLE_BOOKED");
      }
    }
  }

  // Welfare check: if startsAt is changing AND status remains/becomes
  // a load-counting state (scheduled/completed) AND no reason supplied,
  // verify the destination day still fits under the cap.
  if (input.startsAt && (input.status === undefined || input.status === "scheduled" || input.status === "completed")) {
    const reason = (input.overLimitReason ?? "").trim();
    if (!reason) {
      const { data: existing } = await supabase
        .from("lessons")
        .select("horse_id, starts_at")
        .eq("id", lessonId)
        .maybeSingle();
      if (existing) {
        const ex = existing as { horse_id: string | null; starts_at: string };
        const oldDay = ex.starts_at.slice(0, 10);
        const newDay = input.startsAt.slice(0, 10);
        // Welfare load only applies to lessons that have a horse. A
        // TBD-horse lesson carries no workload to re-check on move.
        if (ex.horse_id && oldDay !== newDay) {
          const status = await getHorseWorkloadStatus(ex.horse_id, newDay);
          // The horse_is_overworked counts already include this lesson
          // on the OLD day, not the new one — so adding +1 to the new
          // day's count gives the post-move tally.
          if (status.dailyCount + 1 > status.dailyLimit)  throw new Error("HORSE_OVER_DAILY_LIMIT");
          if (status.weeklyCount + 1 > status.weeklyLimit) throw new Error("HORSE_OVER_WEEKLY_LIMIT");
        }
      }
    }
  }

  // Validate package change before issuing the UPDATE so we can
  // return a friendly error instead of a trigger raise.
  if (input.packageId !== undefined && input.packageId !== null) {
    const { data: existing } = await supabase
      .from("lessons")
      .select("client_id")
      .eq("id", lessonId)
      .maybeSingle();
    if (existing) {
      const lessonClientId = (existing as { client_id: string }).client_id;
      const { data: pkg } = await supabase
        .from("lesson_package_summary")
        .select("client_id, lessons_remaining, is_expired")
        .eq("id", input.packageId)
        .maybeSingle();
      if (!pkg) throw new Error("PACKAGE_NOT_FOUND");
      const p = pkg as { client_id: string; lessons_remaining: number; is_expired: boolean };
      if (p.client_id !== lessonClientId) throw new Error("PACKAGE_WRONG_CLIENT");
      if (p.is_expired)                   throw new Error("PACKAGE_EXPIRED");
      // Don't reject on remaining<=0 here because changing FROM null TO
      // an exhausted package would block, but moving WITHIN a package
      // (status flip) shouldn't. Keep it loose at update time.
    }
  }

  // Snapshot the fields we audit, before the update.
  const { data: beforeRow } = await supabase
    .from("lessons")
    .select("starts_at, ends_at, status, price")
    .eq("id", lessonId)
    .maybeSingle();

  const update: Record<string, unknown> = {};
  if (input.status    !== undefined) update.status    = input.status;
  if (input.startsAt  !== undefined) update.starts_at = input.startsAt;
  if (input.endsAt    !== undefined) update.ends_at   = input.endsAt;
  if (input.price     !== undefined) update.price     = input.price;
  if (input.notes     !== undefined) update.notes     = input.notes;
  if (input.packageId !== undefined) update.package_id = input.packageId;
  if (input.serviceId !== undefined) update.service_id = input.serviceId;
  if (input.arenaId   !== undefined) update.arena_id   = input.arenaId;
  if (input.overLimitReason !== undefined) {
    update.over_limit_reason = input.overLimitReason;
  }

  const { data, error } = await supabase
    .from("lessons")
    .update(update)
    .eq("id", lessonId)
    .select()
    .single();

  if (error) {
    if (error.code === "23P01") throw new Error("HORSE_OR_TRAINER_DOUBLE_BOOKED");
    throw error;
  }

  // Record the change history (best-effort — never block the edit).
  if (beforeRow && data) {
    try {
      await logLessonChanges(
        supabase, lessonId, session.stableId, session.userId,
        beforeRow as any, data as any,
      );
    } catch { /* audit is non-critical */ }
  }
  return data;
}

// Lesson row with names joined in for display. Loose typing because
// `Database` is currently a stub; tighten once `supabase gen types` is run.
export type LessonPaymentStatus = "paid" | "partial" | "unpaid" | "package";

export type CalendarLesson = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  price: number;
  notes: string | null;
  package_id: string | null;
  service_id: string | null;
  /** Group-lesson capacity (1 = individual). Migrated in Sprint 5 #1. */
  max_participants?: number;
  lesson_type?: "individual" | "group";
  /** Arena assignment. Migration 63. */
  arena_id?: string | null;
  arena?: { id: string; name: string; color: string } | null;
  /** Non-null when the trainer overrode the welfare cap. Reason is
   *  the trainer's stated justification; surfaced in the lesson card
   *  badge + audit reports. */
  over_limit_reason: string | null;
  horse:   { id: string; name: string } | null;
  client:  { id: string; full_name: string } | null;
  trainer: { id: string; full_name: string | null } | null;
  service: { id: string; name: string } | null;
  /** Computed in TS from the joined payments rows. */
  payment_status: LessonPaymentStatus;
  /** Sum of payments tagged with this lesson_id. */
  paid_amount: number;
  /** 1-based position of this lesson within its package, ordered by date
   *  (e.g. the 2nd of a 4-lesson subscription). Null when not on a package. */
  package_position?: number | null;
  /** The package's total lesson slots (e.g. 4). Null when not on a package. */
  package_total?: number | null;
};

// All authenticated stable members can read the calendar.
// RLS narrows the result: staff see every lesson; clients see only
// their own (and the horse/trainer rows linked through those lessons).
//
// The 2026-04-28 refresh adds a per-lesson `payment_status` field
// computed in JS from the joined payments rows:
//   * "package" — lesson.package_id is set (covered up front).
//   * "paid"    — sum(payments.amount where lesson_id = lesson.id) >= price.
//   * "partial" — > 0 but < price.
//   * "unpaid"  — 0 paid (and not on a package).
// Employees can't read payments per RLS; for them, paid_amount/status
// will report unpaid/0. The owner-facing UI is the only place this
// status is rendered (employees don't see the badge).
export async function getCalendar(from: string, to: string): Promise<CalendarLesson[]> {
  await getSession(); // assert auth + stable membership; throws otherwise
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("lessons")
    .select(
      `
      id, starts_at, ends_at, status, price, notes, package_id, service_id, over_limit_reason, max_participants, lesson_type, arena_id,
      arena:arenas!lessons_arena_id_fkey(id, name, color),
      horse:horses!lessons_horse_id_fkey(id, name),
      client:clients!lessons_client_id_fkey(id, full_name),
      trainer:profiles(id, full_name),
      service:services(id, name),
      payments(amount)
      `,
    )
    .gte("starts_at", from)
    .lt("starts_at", to)
    .order("starts_at", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as unknown as Array<
    Omit<CalendarLesson, "payment_status" | "paid_amount"> & {
      payments?: { amount: number }[] | null;
    }
  >;

  const mapped: CalendarLesson[] = rows.map((r) => {
    const paid = (r.payments ?? []).reduce(
      (acc, p) => acc + Number(p.amount ?? 0),
      0,
    );
    let payment_status: LessonPaymentStatus;
    if (r.package_id) payment_status = "package";
    else if (paid >= Number(r.price) && Number(r.price) > 0) payment_status = "paid";
    else if (paid >= Number(r.price)) payment_status = "paid";       // price=0 + paid=0 still reads "paid"
    else if (paid > 0) payment_status = "partial";
    else payment_status = "unpaid";

    // Strip the joined payments array from the public shape so the
    // CalendarLesson type stays clean for downstream callers.
    const { payments: _, ...rest } = r as { payments?: unknown };
    void _;
    return {
      ...(rest as Omit<CalendarLesson, "payment_status" | "paid_amount">),
      paid_amount: paid,
      payment_status,
      package_position: null,
      package_total: null,
    };
  });

  // Enrich package-covered lessons with "position / total" (e.g. 2 of 4).
  // Two extra reads, only when at least one lesson is on a package.
  // Position is counted across ALL the package's non-cancelled lessons by
  // date — not just the current week — so the ordinal is correct.
  const pkgIds = Array.from(
    new Set(mapped.filter((l) => l.package_id).map((l) => l.package_id as string)),
  );
  if (pkgIds.length > 0) {
    const [allPkgLessonsRes, pkgsRes] = await Promise.all([
      supabase
        .from("lessons")
        .select("id, package_id, starts_at")
        .in("package_id", pkgIds)
        .neq("status", "cancelled")
        .order("starts_at", { ascending: true }),
      supabase
        .from("lesson_packages")
        .select("id, total_lessons")
        .in("id", pkgIds),
    ]);

    const totalById = new Map<string, number>();
    for (const p of (pkgsRes.data ?? []) as { id: string; total_lessons: number }[]) {
      totalById.set(p.id, Number(p.total_lessons));
    }
    const positionByLessonId = new Map<string, number>();
    const runningCount = new Map<string, number>();
    for (const l of (allPkgLessonsRes.data ?? []) as { id: string; package_id: string }[]) {
      const n = (runningCount.get(l.package_id) ?? 0) + 1;
      runningCount.set(l.package_id, n);
      positionByLessonId.set(l.id, n);
    }
    for (const l of mapped) {
      if (l.package_id) {
        l.package_position = positionByLessonId.get(l.id) ?? null;
        l.package_total = totalById.get(l.package_id) ?? null;
      }
    }
  }

  return mapped;
}

// Workload summary for a horse over a window.
// Owner + employee. Clients have no horse-roster access.
export async function getHorseWorkload(horseId: string, from: string, to: string) {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("horse_workload", {
    p_horse_id: horseId,
    p_from: from,
    p_to: to,
  });
  if (error) throw error;
  return data?.[0] ?? { total_lessons: 0, total_minutes: 0 };
}


// Lessons for a single client, either upcoming or recent — used by
// the client detail page. Owner + employee.
export type ClientLessonRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  price: number;
  horse:   { id: string; name: string } | null;
  trainer: { id: string; full_name: string | null } | null;
};

export async function getClientLessons(
  clientId: string,
  opts: { direction: "upcoming" | "recent"; limit?: number },
): Promise<ClientLessonRow[]> {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();

  let q = supabase
    .from("lessons")
    .select(
      `
      id, starts_at, ends_at, status, price,
      horse:horses!lessons_horse_id_fkey(id, name),
      trainer:profiles(id, full_name)
      `,
    )
    .eq("client_id", clientId);

  if (opts.direction === "upcoming") {
    q = q.gte("starts_at", now).order("starts_at", { ascending: true });
  } else {
    q = q.lt("starts_at", now).order("starts_at", { ascending: false });
  }

  const { data, error } = await q.limit(opts.limit ?? 10);
  if (error) throw error;
  return (data ?? []) as unknown as ClientLessonRow[];
}

// Recent lessons for a single horse — used by the horse detail page.
export type HorseLessonRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  price: number;
  client:  { id: string; full_name: string } | null;
  trainer: { id: string; full_name: string | null } | null;
};

export async function getHorseLessons(
  horseId: string,
  opts?: { limit?: number },
): Promise<HorseLessonRow[]> {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("lessons")
    .select(
      `
      id, starts_at, ends_at, status, price,
      client:clients!lessons_client_id_fkey(id, full_name),
      trainer:profiles(id, full_name)
      `,
    )
    .eq("horse_id", horseId)
    .order("starts_at", { ascending: false })
    .limit(opts?.limit ?? 20);
  if (error) throw error;
  return (data ?? []) as unknown as HorseLessonRow[];
}
