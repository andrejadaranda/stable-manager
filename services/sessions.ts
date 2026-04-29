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

// ---------- stats ----------------------------------------------------------

export type SessionStats = {
  totalCount: number;
  totalMinutes: number;
  weekCount: number;
  weekMinutes: number;
  monthCount: number;
  monthMinutes: number;
  /** Most-ridden horse over the lookback window (90 days). */
  topHorse: { id: string; name: string; sessions: number } | null;
  /** Type → minutes breakdown over the lookback window (90 days). */
  typeBreakdown: Array<{ type: SessionType; count: number; minutes: number }>;
  /** Number of consecutive ISO weeks with at least 1 session, ending now. */
  currentStreakWeeks: number;
};

/** Aggregated stats for the staff sessions page (whole stable).
 *  RLS narrows to caller's stable automatically. */
export async function getStableSessionStats(): Promise<SessionStats> {
  const ctx = await getSession();
  requireRole(ctx, "owner", "employee");
  return computeStats(undefined);
}

/** Aggregated stats for one client (their own rides only). */
export async function getMySessionStats(): Promise<SessionStats> {
  const ctx = await getSession();
  requireRole(ctx, "client");
  if (!ctx.clientId) return emptyStats();
  return computeStats(ctx.clientId);
}

async function computeStats(
  riderClientId: string | undefined,
): Promise<SessionStats> {
  const supabase = createSupabaseServerClient();
  const lookbackDays = 90;
  const fromIso = new Date(Date.now() - lookbackDays * 86_400_000).toISOString();

  let q = supabase
    .from("sessions")
    .select(
      "id, started_at, duration_minutes, type, horse:horses(id, name)",
    )
    .gte("started_at", fromIso)
    .order("started_at", { ascending: false });
  if (riderClientId) q = q.eq("rider_client_id", riderClientId);

  const { data, error } = await q;
  if (error) throw error;

  type Row = {
    id: string;
    started_at: string;
    duration_minutes: number;
    type: SessionType;
    horse: { id: string; name: string } | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  const now = Date.now();
  const weekAgo  = now - 7  * 86_400_000;
  const monthAgo = now - 30 * 86_400_000;

  let weekCount = 0,  weekMinutes  = 0;
  let monthCount = 0, monthMinutes = 0;

  const horseCounts = new Map<string, { name: string; count: number }>();
  const typeAgg = new Map<SessionType, { count: number; minutes: number }>();

  for (const r of rows) {
    const t = new Date(r.started_at).getTime();
    const d = Number(r.duration_minutes ?? 0);

    if (t >= weekAgo)  { weekCount  += 1; weekMinutes  += d; }
    if (t >= monthAgo) { monthCount += 1; monthMinutes += d; }

    if (r.horse) {
      const cur = horseCounts.get(r.horse.id);
      horseCounts.set(r.horse.id, {
        name:  r.horse.name,
        count: (cur?.count ?? 0) + 1,
      });
    }

    const cur = typeAgg.get(r.type) ?? { count: 0, minutes: 0 };
    cur.count   += 1;
    cur.minutes += d;
    typeAgg.set(r.type, cur);
  }

  const totalCount   = rows.length;
  const totalMinutes = rows.reduce((acc, r) => acc + Number(r.duration_minutes ?? 0), 0);

  let topHorse: SessionStats["topHorse"] = null;
  for (const [id, info] of horseCounts) {
    if (!topHorse || info.count > topHorse.sessions) {
      topHorse = { id, name: info.name, sessions: info.count };
    }
  }

  const typeBreakdown: SessionStats["typeBreakdown"] = Array.from(typeAgg.entries())
    .map(([type, v]) => ({ type, count: v.count, minutes: v.minutes }))
    .sort((a, b) => b.minutes - a.minutes);

  // Streak: walk back week-by-week from current ISO week. A week counts if
  // at least one session falls inside it.
  const weekKeys = new Set<string>();
  for (const r of rows) weekKeys.add(isoWeekKey(new Date(r.started_at)));

  let currentStreakWeeks = 0;
  const cursor = new Date();
  while (currentStreakWeeks < 53) {
    const key = isoWeekKey(cursor);
    if (weekKeys.has(key)) {
      currentStreakWeeks += 1;
      cursor.setDate(cursor.getDate() - 7);
    } else {
      break;
    }
  }

  return {
    totalCount,
    totalMinutes,
    weekCount,
    weekMinutes,
    monthCount,
    monthMinutes,
    topHorse,
    typeBreakdown,
    currentStreakWeeks,
  };
}

function emptyStats(): SessionStats {
  return {
    totalCount: 0,
    totalMinutes: 0,
    weekCount: 0,
    weekMinutes: 0,
    monthCount: 0,
    monthMinutes: 0,
    topHorse: null,
    typeBreakdown: [],
    currentStreakWeeks: 0,
  };
}

function isoWeekKey(date: Date): string {
  // YYYY-Www. Standard ISO week.
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
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
