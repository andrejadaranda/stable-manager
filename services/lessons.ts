// Lessons service — central calendar logic.
// RLS handles tenant isolation; service layer adds role gates and
// translates Postgres exclusion-constraint errors to domain errors.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";
import { getHorseWorkloadStatus } from "@/services/horses";

export type CreateLessonInput = {
  horseId: string;
  clientId: string;
  trainerId: string;   // profiles.id of the trainer
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

  // Friendly preflight against the exclusion constraint.
  const { data: free } = await supabase.rpc("check_horse_available", {
    p_horse_id: input.horseId,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_exclude_lesson: null,
  });
  if (free === false) throw new Error("HORSE_DOUBLE_BOOKED");

  // Welfare check: would adding this lesson push the horse over its
  // daily or weekly cap? horse_is_overworked() returns the *current*
  // counts on the supplied date, so we compare with-this-lesson-added.
  const reason = (input.overLimitReason ?? "").trim();
  if (!reason) {
    const status = await getHorseWorkloadStatus(
      input.horseId,
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
      horse_id: input.horseId,
      client_id: input.clientId,
      trainer_id: input.trainerId,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      price: input.price ?? 0,
      notes: input.notes ?? null,
      package_id: input.packageId ?? null,
      service_id: input.serviceId ?? null,
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
  return data;
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
  /** When moving a lesson into a day that pushes the horse over its
   *  cap, the trainer must supply a reason. Saved verbatim. */
  overLimitReason?: string | null;
};

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
      if (existing) {
        const { data: free } = await supabase.rpc("check_horse_available", {
          p_horse_id:        (existing as { horse_id: string }).horse_id,
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
        const ex = existing as { horse_id: string; starts_at: string };
        const oldDay = ex.starts_at.slice(0, 10);
        const newDay = input.startsAt.slice(0, 10);
        if (oldDay !== newDay) {
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

  const update: Record<string, unknown> = {};
  if (input.status    !== undefined) update.status    = input.status;
  if (input.startsAt  !== undefined) update.starts_at = input.startsAt;
  if (input.endsAt    !== undefined) update.ends_at   = input.endsAt;
  if (input.price     !== undefined) update.price     = input.price;
  if (input.notes     !== undefined) update.notes     = input.notes;
  if (input.packageId !== undefined) update.package_id = input.packageId;
  if (input.serviceId !== undefined) update.service_id = input.serviceId;
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
      id, starts_at, ends_at, status, price, notes, package_id, service_id, over_limit_reason,
      horse:horses(id, name),
      client:clients(id, full_name),
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

  return rows.map((r) => {
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
    };
  });
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
      horse:horses(id, name),
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
      client:clients(id, full_name),
      trainer:profiles(id, full_name)
      `,
    )
    .eq("horse_id", horseId)
    .order("starts_at", { ascending: false })
    .limit(opts?.limit ?? 20);
  if (error) throw error;
  return (data ?? []) as unknown as HorseLessonRow[];
}
