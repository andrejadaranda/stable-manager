// Horse profile aggregation service.
//
// One file, one mental model: every read needed to render the new
// /dashboard/horses/[id] screen lives here. Each function is small,
// composable, and runs under the caller's JWT (RLS does the gating).
//
// Phase 1 scope:
//   - getHorseProfileSummary(id) — hero data + KPIs in one round-trip
//   - getHorseHeatmap(id, days)  — daily session counts for the heatmap
//   - getHorseTypeBreakdown(id)  — donut chart data
//   - getHorseUpcomingLessons(id, days) — schedule rail data
//
// Health, goals, and media tabs come in later phases.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";
import type { SessionType } from "@/services/sessions";

// ---------------- Types ---------------------------------------

export type HorseProfileSummary = {
  id: string;
  stable_id: string;
  name: string;
  breed: string | null;
  date_of_birth: string | null;
  active: boolean;
  notes: string | null;
  photo_url: string | null;
  daily_lesson_limit: number;
  weekly_lesson_limit: number;
  owner_client_id: string | null;
  owner_client_name: string | null;
  /** Default boarding fee used to pre-fill new charges. Null if unset
   *  or if the stable owns the horse. */
  monthly_boarding_fee: number | null;
  /** Owner has opted this client-owned horse into the lessons dropdown.
   *  Stable-owned horses (owner_client_id = null) ignore this flag. */
  available_for_lessons: boolean;

  // KPIs over the current ISO week (Mon 00:00 → next Mon 00:00, server time).
  week: {
    lesson_count: number;
    session_count: number;
    minutes_ridden: number;
    next_lesson_at: string | null;     // earliest upcoming lesson, if any
    last_session_at: string | null;    // most recent past session, if any
  };
};

export type HeatmapDay = {
  /** YYYY-MM-DD in stable's local interpretation (we keep server tz for now). */
  date: string;
  count: number;
  minutes: number;
};

export type TypeBreakdownSlice = {
  type: SessionType;
  count: number;
  minutes: number;
};

export type UpcomingLesson = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  client: { id: string; full_name: string } | null;
  trainer: { id: string; full_name: string | null } | null;
};

// ---------------- Helpers -------------------------------------

function isoWeekBounds(now = new Date()): { start: string; end: string } {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  // ISO week: Monday is day 1.
  const day = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() - (day - 1));
  const start = new Date(d);
  const end = new Date(d);
  end.setDate(end.getDate() + 7);
  return { start: start.toISOString(), end: end.toISOString() };
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

// ---------------- API -----------------------------------------

/**
 * Single combined fetch for the hero + KPI strip. Five small queries
 * in parallel (none N+1) so the page renders in one round-trip.
 *
 * Phase 1 visibility: staff (owner + employee) only. Owner-client and
 * rider-client lenses come in Phase 2.
 */
export async function getHorseProfileSummary(
  horseId: string,
): Promise<HorseProfileSummary | null> {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();
  const { start, end } = isoWeekBounds();

  const [
    horseRes,
    lessonsWeekRes,
    sessionsWeekRes,
    nextLessonRes,
    lastSessionRes,
  ] = await Promise.all([
    supabase
      .from("horses")
      .select(
        `id, stable_id, name, breed, date_of_birth, active, notes, photo_url,
         daily_lesson_limit, weekly_lesson_limit, owner_client_id, monthly_boarding_fee,
         available_for_lessons,
         owner_client:clients!horses_owner_client_id_fkey(id, full_name)`,
      )
      .eq("id", horseId)
      .maybeSingle(),
    supabase
      .from("lessons")
      .select("id, starts_at, ends_at, status")
      .eq("horse_id", horseId)
      .gte("starts_at", start)
      .lt("starts_at", end)
      .in("status", ["scheduled", "completed"]),
    supabase
      .from("sessions")
      .select("id, started_at, duration_minutes")
      .eq("horse_id", horseId)
      .gte("started_at", start)
      .lt("started_at", end),
    supabase
      .from("lessons")
      .select("id, starts_at")
      .eq("horse_id", horseId)
      .eq("status", "scheduled")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("sessions")
      .select("id, started_at")
      .eq("horse_id", horseId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (horseRes.error) throw horseRes.error;
  if (!horseRes.data) return null;

  const horse = horseRes.data as any;
  const lessons = (lessonsWeekRes.data ?? []) as Array<{
    starts_at: string; ends_at: string; status: string;
  }>;
  const sessions = (sessionsWeekRes.data ?? []) as Array<{
    started_at: string; duration_minutes: number;
  }>;

  const minutes_ridden = sessions.reduce(
    (sum, s) => sum + (s.duration_minutes ?? 0), 0,
  );

  return {
    id: horse.id,
    stable_id: horse.stable_id,
    name: horse.name,
    breed: horse.breed,
    date_of_birth: horse.date_of_birth,
    active: horse.active,
    notes: horse.notes,
    photo_url: horse.photo_url,
    daily_lesson_limit: horse.daily_lesson_limit,
    weekly_lesson_limit: horse.weekly_lesson_limit,
    owner_client_id: horse.owner_client_id,
    owner_client_name: horse.owner_client?.full_name ?? null,
    monthly_boarding_fee:
      horse.monthly_boarding_fee != null ? Number(horse.monthly_boarding_fee) : null,
    available_for_lessons: Boolean(horse.available_for_lessons),
    week: {
      lesson_count: lessons.length,
      session_count: sessions.length,
      minutes_ridden,
      next_lesson_at: (nextLessonRes.data as any)?.starts_at ?? null,
      last_session_at: (lastSessionRes.data as any)?.started_at ?? null,
    },
  };
}

/**
 * Per-day session counts for the last `days` days (default 84 = 12 weeks).
 * Returned ascending (oldest first) so the UI can render columns left-to-right.
 */
export async function getHorseHeatmap(
  horseId: string,
  days = 84,
): Promise<HeatmapDay[]> {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const fromDate = new Date();
  fromDate.setHours(0, 0, 0, 0);
  fromDate.setDate(fromDate.getDate() - (days - 1));

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("started_at, duration_minutes")
    .eq("horse_id", horseId)
    .gte("started_at", fromDate.toISOString());
  if (error) throw error;

  const byDay = new Map<string, HeatmapDay>();
  for (let i = 0; i < days; i++) {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + i);
    const key = dayKey(d.toISOString());
    byDay.set(key, { date: key, count: 0, minutes: 0 });
  }
  for (const row of (data ?? []) as Array<{ started_at: string; duration_minutes: number }>) {
    const key = dayKey(row.started_at);
    const slot = byDay.get(key);
    if (!slot) continue;
    slot.count += 1;
    slot.minutes += row.duration_minutes ?? 0;
  }
  return Array.from(byDay.values());
}

/**
 * Session counts grouped by `type` over the last `days` days. Used by
 * the donut chart on the Overview tab.
 */
export async function getHorseTypeBreakdown(
  horseId: string,
  days = 30,
): Promise<TypeBreakdownSlice[]> {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const fromDate = new Date();
  fromDate.setHours(0, 0, 0, 0);
  fromDate.setDate(fromDate.getDate() - (days - 1));

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("type, duration_minutes")
    .eq("horse_id", horseId)
    .gte("started_at", fromDate.toISOString());
  if (error) throw error;

  const byType = new Map<SessionType, TypeBreakdownSlice>();
  for (const row of (data ?? []) as Array<{ type: SessionType; duration_minutes: number }>) {
    const cur = byType.get(row.type) ?? { type: row.type, count: 0, minutes: 0 };
    cur.count += 1;
    cur.minutes += row.duration_minutes ?? 0;
    byType.set(row.type, cur);
  }

  return Array.from(byType.values()).sort((a, b) => b.count - a.count);
}

/**
 * Upcoming + last-N-days lessons on this horse, joined to client + trainer
 * for display. Drives the schedule rail and the small "Recent lessons"
 * peek under the Sessions tab.
 */
export async function getHorseUpcomingLessons(
  horseId: string,
  daysAhead = 14,
): Promise<UpcomingLesson[]> {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const now = new Date();
  const ahead = new Date(now);
  ahead.setDate(ahead.getDate() + daysAhead);

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("lessons")
    .select(
      `id, starts_at, ends_at, status,
       client:clients(id, full_name),
       trainer:profiles!lessons_trainer_id_fkey(id, full_name)`,
    )
    .eq("horse_id", horseId)
    .gte("starts_at", now.toISOString())
    .lt("starts_at", ahead.toISOString())
    .in("status", ["scheduled", "completed"])
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as UpcomingLesson[];
}
