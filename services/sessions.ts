// Sessions service — the "horse activity" core.
// Staff (owner/employee) log + read all sessions in their stable.
// Clients read only sessions where they were the rider.
//
// Types + the SESSION_TYPES constant live in services/sessions.types.ts
// so client components can import them without pulling next/headers
// into the client bundle.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";

export {
  SESSION_TYPES,
  type SessionType,
  type SessionRow,
  type SessionWithLabels,
} from "./sessions.types";

import type { SessionType, SessionWithLabels } from "./sessions.types";

const SELECT_WITH_LABELS = `
  *,
  horse:horses(id, name),
  rider_client:clients(id, full_name),
  trainer:profiles!sessions_trainer_id_fkey(id, full_name)
`;

// ---------- list (staff) ----------------------------------------------------
export async function listSessions(opts?: {
  horseId?: string;
  riderClientId?: string;
  fromIso?: string;
  toIso?: string;
  limit?: number;
}): Promise<SessionWithLabels[]> {
  const ctx = await getSession();
  requireRole(ctx, "owner", "employee");

  const supabase = createSupabaseServerClient();
  let q = supabase
    .from("sessions")
    .select(SELECT_WITH_LABELS)
    .order("started_at", { ascending: false });

  if (opts?.horseId)        q = q.eq("horse_id", opts.horseId);
  if (opts?.riderClientId)  q = q.eq("rider_client_id", opts.riderClientId);
  if (opts?.fromIso)        q = q.gte("started_at", opts.fromIso);
  if (opts?.toIso)          q = q.lt("started_at", opts.toIso);
  q = q.limit(opts?.limit ?? 100);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as SessionWithLabels[];
}

// ---------- list (client portal) -------------------------------------------
// "My rides" — used by /dashboard/my-sessions or wherever clients see history.
export async function listMySessions(limit = 50): Promise<SessionWithLabels[]> {
  const ctx = await getSession();
  requireRole(ctx, "client");
  if (!ctx.clientId) return [];

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sessions")
    .select(SELECT_WITH_LABELS)
    .eq("rider_client_id", ctx.clientId)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as SessionWithLabels[];
}

// ---------- create ---------------------------------------------------------
export async function createSession(input: {
  horseId: string;
  riderClientId?: string;
  riderProfileId?: string;
  riderNameFreeform?: string;
  startedAt?: string;
  durationMinutes: number;
  type: SessionType;
  notes?: string;
  rating?: number;
  lessonId?: string;
}) {
  const ctx = await getSession();
  requireRole(ctx, "owner", "employee");

  if (
    !input.riderClientId &&
    !input.riderProfileId &&
    !input.riderNameFreeform
  ) {
    throw new Error("MISSING_RIDER");
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      stable_id:           ctx.stableId,
      horse_id:            input.horseId,
      rider_client_id:     input.riderClientId      ?? null,
      rider_profile_id:    input.riderProfileId     ?? null,
      rider_name_freeform: input.riderNameFreeform  ?? null,
      trainer_id:          ctx.userId,
      lesson_id:           input.lessonId           ?? null,
      started_at:          input.startedAt          ?? new Date().toISOString(),
      duration_minutes:    input.durationMinutes,
      type:                input.type,
      notes:               input.notes              ?? null,
      rating:              input.rating             ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------- update ---------------------------------------------------------
export type UpdateSessionInput = {
  durationMinutes?: number;
  type?: SessionType;
  notes?: string | null;
  rating?: number | null;
  startedAt?: string;
};

export async function updateSession(id: string, input: UpdateSessionInput) {
  const ctx = await getSession();
  requireRole(ctx, "owner", "employee");

  const update: Record<string, unknown> = {};
  if (input.durationMinutes !== undefined) update.duration_minutes = input.durationMinutes;
  if (input.type            !== undefined) update.type             = input.type;
  if (input.notes           !== undefined) update.notes            = input.notes;
  if (input.rating          !== undefined) update.rating           = input.rating;
  if (input.startedAt       !== undefined) update.started_at       = input.startedAt;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sessions")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------- delete ---------------------------------------------------------
export async function deleteSession(id: string) {
  const ctx = await getSession();
  requireRole(ctx, "owner", "employee");

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("sessions").delete().eq("id", id);
  if (error) throw error;
}

// ---------- dashboard heatmap ---------------------------------------------
// Per-active-horse session counts for the last 7 days. Backed by the view
// v_horse_activity_7d defined in 12_sessions.sql.
export type HorseActivity7d = {
  horse_id: string;
  name: string;
  sessions_last_7d: number;
  minutes_last_7d: number;
  last_session_at: string | null;
};

export async function listHorseActivity7d(): Promise<HorseActivity7d[]> {
  const ctx = await getSession();
  requireRole(ctx, "owner", "employee");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("v_horse_activity_7d")
    .select("horse_id, name, sessions_last_7d, minutes_last_7d, last_session_at")
    .order("name");
  if (error) throw error;
  return (data ?? []) as HorseActivity7d[];
}

// ---------- Lesson → Session conversion ------------------------------------
// Called when a lesson's status flips to 'completed'. Idempotent: if a
// session is already linked to this lesson, returns that id and inserts
// nothing. Used by updateLessonAction.
export async function createSessionFromLesson(lessonId: string): Promise<string | null> {
  const ctx = await getSession();
  requireRole(ctx, "owner", "employee");

  const supabase = createSupabaseServerClient();

  // 1. Idempotency — bail if a session already tracks this lesson.
  const { data: existing } = await supabase
    .from("sessions")
    .select("id")
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (existing) return existing.id;

  // 2. Load the lesson (RLS narrows to staff in this stable).
  const { data: lesson, error } = await supabase
    .from("lessons")
    .select("id, stable_id, horse_id, client_id, trainer_id, starts_at, ends_at, status")
    .eq("id", lessonId)
    .single();
  if (error || !lesson) throw new Error("LESSON_NOT_FOUND");
  if (lesson.status !== "completed") throw new Error("LESSON_NOT_COMPLETED");

  const startMs = new Date(lesson.starts_at).getTime();
  const endMs   = new Date(lesson.ends_at).getTime();
  const duration = Math.max(1, Math.round((endMs - startMs) / 60000));

  const { data, error: insErr } = await supabase
    .from("sessions")
    .insert({
      stable_id:        lesson.stable_id,
      horse_id:         lesson.horse_id,
      rider_client_id:  lesson.client_id,
      trainer_id:       lesson.trainer_id,
      lesson_id:        lesson.id,
      started_at:       lesson.starts_at,
      duration_minutes: duration,
      type:             "flat", // sane default; trainer edits later if needed
    })
    .select("id")
    .single();
  if (insErr) throw insErr;
  return data.id;
}
