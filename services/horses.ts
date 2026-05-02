// Horses service — owner + employee only.
// Clients have no roster access in MVP (RLS also enforces this).

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";

export type HorseRow = {
  id: string;
  stable_id: string;
  name: string;
  breed: string | null;
  date_of_birth: string | null;
  daily_lesson_limit: number;
  weekly_lesson_limit: number;
  active: boolean;
  notes: string | null;
  owner_client_id: string | null;
  available_for_lessons: boolean;
  public_bio: string | null;
  /** Backup contact name (called when the owner can't be reached). */
  backup_contact_name:     string | null;
  backup_contact_phone:    string | null;
  /** Free text: "vet", "neighbour", "partner", etc. */
  backup_contact_relation: string | null;
  created_at: string;
  updated_at: string;
};

/** Subset of the horse row that's safe to render in the client portal.
 *  Excludes staff-only fields (notes, owner_client_id, limits, etc). */
export type HorsePublicView = {
  id: string;
  name: string;
  breed: string | null;
  photo_url: string | null;
  public_bio: string | null;
};

export type HorseWeeklyWorkload = {
  total_lessons: number;
  total_minutes: number;
};

export type HorseWithWeeklyWorkload = HorseRow & { weekly: HorseWeeklyWorkload };

// ------- list -------------------------------------------------------------
export async function listHorses(opts?: {
  activeOnly?: boolean;
  /** When true, include only horses eligible for lessons:
   *   - Stable-owned (owner_client_id IS NULL) — always eligible
   *   - Client-owned only if `available_for_lessons = TRUE`
   *
   * The calendar's "pick a horse" dropdown uses this. Other surfaces
   * (Horses index, settings) leave it off and see all horses. */
  lessonsOnly?: boolean;
}): Promise<HorseRow[]> {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();
  let q = supabase.from("horses").select("*").order("name");
  if (opts?.activeOnly) q = q.eq("active", true);
  if (opts?.lessonsOnly) {
    // Postgres OR: stable-owned, or client-owned-and-opted-in.
    q = q.or("owner_client_id.is.null,available_for_lessons.is.true");
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as HorseRow[];
}

// List + this-week workload aggregated in two queries (avoids N+1 RPC).
// Used by the horses index page.
export async function listHorsesWithWeeklyWorkload(
  weekStart: string,
  weekEnd: string,
): Promise<HorseWithWeeklyWorkload[]> {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();
  const [horsesRes, lessonsRes] = await Promise.all([
    supabase.from("horses").select("*").order("name"),
    supabase
      .from("lessons")
      .select("horse_id, starts_at, ends_at, status")
      .gte("starts_at", weekStart)
      .lt("starts_at", weekEnd)
      .in("status", ["scheduled", "completed"]),
  ]);
  if (horsesRes.error)  throw horsesRes.error;
  if (lessonsRes.error) throw lessonsRes.error;

  const counts = new Map<string, HorseWeeklyWorkload>();
  for (const l of (lessonsRes.data ?? []) as Array<{ horse_id: string; starts_at: string; ends_at: string }>) {
    const c = counts.get(l.horse_id) ?? { total_lessons: 0, total_minutes: 0 };
    c.total_lessons += 1;
    c.total_minutes += Math.round(
      (new Date(l.ends_at).getTime() - new Date(l.starts_at).getTime()) / 60000,
    );
    counts.set(l.horse_id, c);
  }

  return ((horsesRes.data ?? []) as HorseRow[]).map((h) => ({
    ...h,
    weekly: counts.get(h.id) ?? { total_lessons: 0, total_minutes: 0 },
  }));
}

// ------- get one ----------------------------------------------------------
export async function getHorse(id: string): Promise<HorseRow | null> {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("horses")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as HorseRow) ?? null;
}

// ------- create -----------------------------------------------------------
export async function createHorse(input: {
  name: string;
  breed?: string;
  dateOfBirth?: string;
  dailyLessonLimit?: number;
  weeklyLessonLimit?: number;
  active?: boolean;
  notes?: string;
}) {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("horses")
    .insert({
      stable_id: session.stableId,
      name: input.name,
      breed: input.breed ?? null,
      date_of_birth: input.dateOfBirth ?? null,
      daily_lesson_limit: input.dailyLessonLimit ?? 4,
      weekly_lesson_limit: input.weeklyLessonLimit ?? 20,
      active: input.active ?? true,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ------- public view (client portal) --------------------------------------

/** Fetches the public-safe view of a horse. Used by the client portal
 *  page where a rider taps their assigned horse on a lesson card.
 *  RLS already narrows to horses the caller can see; for clients that
 *  means horses tied to their own lessons (07_calendar_policies.sql).
 */
export async function getHorsePublicView(
  horseId: string,
): Promise<HorsePublicView | null> {
  await getSession();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("horses")
    .select("id, name, breed, photo_url, public_bio")
    .eq("id", horseId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as HorsePublicView | null;
}

/** Owner-only setter for the public bio. */
export async function setHorsePublicBio(
  horseId: string,
  bio: string | null,
): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner");
  const supabase = createSupabaseServerClient();
  const trimmed = bio?.trim() ?? null;
  const { error } = await supabase
    .from("horses")
    .update({ public_bio: trimmed && trimmed.length > 0 ? trimmed : null })
    .eq("id", horseId);
  if (error) throw error;
}

// ------- update -----------------------------------------------------------
export type UpdateHorseInput = {
  name?: string;
  active?: boolean;
  dailyLessonLimit?: number;
  weeklyLessonLimit?: number;
  notes?: string | null;
  /** Pass null to clear the owner. */
  ownerClientId?: string | null;
  /** Owner-curated description visible to clients. Pass null to clear. */
  publicBio?: string | null;
  /** Public URL of the horse photo. Pass null to clear. */
  photoUrl?: string | null;
  backupContactName?:     string | null;
  backupContactPhone?:    string | null;
  backupContactRelation?: string | null;
};

export async function updateHorse(id: string, input: UpdateHorseInput) {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();
  const update: Record<string, unknown> = {};
  if (input.name              !== undefined) update.name                = input.name;
  if (input.active            !== undefined) update.active              = input.active;
  if (input.dailyLessonLimit  !== undefined) update.daily_lesson_limit  = input.dailyLessonLimit;
  if (input.weeklyLessonLimit !== undefined) update.weekly_lesson_limit = input.weeklyLessonLimit;
  if (input.notes             !== undefined) update.notes               = input.notes;
  if (input.ownerClientId     !== undefined) update.owner_client_id     = input.ownerClientId;
  if (input.publicBio         !== undefined) update.public_bio          = input.publicBio;
  if (input.photoUrl          !== undefined) update.photo_url           = input.photoUrl;
  if (input.backupContactName     !== undefined) update.backup_contact_name     = input.backupContactName;
  if (input.backupContactPhone    !== undefined) update.backup_contact_phone    = input.backupContactPhone;
  if (input.backupContactRelation !== undefined) update.backup_contact_relation = input.backupContactRelation;

  const { data, error } = await supabase
    .from("horses")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Quick "set owner" shortcut used by the boarding tab so the user can
// assign without opening the full edit dialog. Owner-only; same RLS
// applies. Pass null to clear.
export async function setHorseOwner(
  horseId: string,
  ownerClientId: string | null,
): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("horses")
    .update({ owner_client_id: ownerClientId })
    .eq("id", horseId);
  if (error) throw error;
}

// Toggle whether a client-owned horse is eligible for stable lessons.
// No effect on stable-owned horses (they're always eligible). Owner-only.
export async function setHorseLessonsAvailability(
  horseId: string,
  available: boolean,
): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("horses")
    .update({ available_for_lessons: available })
    .eq("id", horseId);
  if (error) throw error;
}

// ------- workload helpers (used by the horse detail page) ----------------

export type HorseWorkloadStatus = {
  dailyCount: number;
  dailyLimit: number;
  weeklyCount: number;
  weeklyLimit: number;
  overDaily: boolean;
  overWeekly: boolean;
};

/** Daily + weekly workload for one horse on a given date. Backed by the
 *  `horse_is_overworked` SQL function (05_functions.sql). Used by the
 *  welfare guard on lesson create/update + by the horse profile hero
 *  status pill. */
export async function getHorseWorkloadStatus(
  horseId: string,
  on: string, // YYYY-MM-DD
): Promise<HorseWorkloadStatus> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  void session;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("horse_is_overworked", {
    p_horse_id: horseId,
    p_on: on,
  });
  if (error) throw error;
  const row = (data?.[0] ?? {}) as {
    daily_count?: number;  daily_limit?: number;
    weekly_count?: number; weekly_limit?: number;
    over_daily?: boolean;  over_weekly?: boolean;
  };
  return {
    dailyCount:  Number(row.daily_count  ?? 0),
    dailyLimit:  Number(row.daily_limit  ?? 0),
    weeklyCount: Number(row.weekly_count ?? 0),
    weeklyLimit: Number(row.weekly_limit ?? 0),
    overDaily:   Boolean(row.over_daily),
    overWeekly:  Boolean(row.over_weekly),
  };
}
