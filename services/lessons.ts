// Lessons service — central calendar logic.
// RLS handles tenant isolation; service layer adds role gates and
// translates Postgres exclusion-constraint errors to domain errors.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";

export type CreateLessonInput = {
  horseId: string;
  clientId: string;
  trainerId: string;   // profiles.id of the trainer
  startsAt: string;    // ISO timestamp
  endsAt: string;      // ISO timestamp
  price?: number;
  notes?: string;
};

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

  const update: Record<string, unknown> = {};
  if (input.status    !== undefined) update.status    = input.status;
  if (input.startsAt  !== undefined) update.starts_at = input.startsAt;
  if (input.endsAt    !== undefined) update.ends_at   = input.endsAt;
  if (input.price     !== undefined) update.price     = input.price;
  if (input.notes     !== undefined) update.notes     = input.notes;

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
export type CalendarLesson = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  price: number;
  notes: string | null;
  horse:   { id: string; name: string } | null;
  client:  { id: string; full_name: string } | null;
  trainer: { id: string; full_name: string | null } | null;
};

// All authenticated stable members can read the calendar.
// RLS narrows the result: staff see every lesson; clients see only
// their own (and the horse/trainer rows linked through those lessons).
export async function getCalendar(from: string, to: string): Promise<CalendarLesson[]> {
  await getSession(); // assert auth + stable membership; throws otherwise
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("lessons")
    .select(
      `
      id, starts_at, ends_at, status, price, notes,
      horse:horses(id, name),
      client:clients(id, full_name),
      trainer:profiles(id, full_name)
      `,
    )
    .gte("starts_at", from)
    .lt("starts_at", to)
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CalendarLesson[];
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
