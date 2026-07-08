// Account service — caller's own profile.
// Used by /dashboard/settings/profile.

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

/**
 * Permanently delete the signed-in user's account (App Store guideline
 * 5.1.1(v) — in-app account deletion).
 *
 * - Owner: the account IS the stable, so this deletes the stable and
 *   everything in it (horses, clients, lessons, payments, …) via ON DELETE
 *   CASCADE, then removes the Auth login.
 * - Employee / client: removes only that person's profile (their access to
 *   the stable) and their Auth login. The stable's operational data stays.
 *
 * Runs with the service role (admin) so it can reach auth.users. There is
 * no undo — the caller MUST confirm first.
 */
export async function deleteMyAccount(): Promise<void> {
  const session = await getSession();
  const admin = createSupabaseAdminClient();

  if (session.role === "owner") {
    const { error } = await admin.from("stables").delete().eq("id", session.stableId);
    if (error) throw error;
  } else {
    const { error } = await admin.from("profiles").delete().eq("id", session.userId);
    if (error) throw error;
  }

  // Remove the Supabase Auth user last so the login is permanently gone.
  const { error: authErr } = await admin.auth.admin.deleteUser(session.authUserId);
  if (authErr) throw authErr;
}

export type OwnProfileRow = {
  id: string;
  full_name: string | null;
  role: "owner" | "employee" | "client";
  email: string | null;
  photo_url: string | null;
  phone: string | null;
};

export async function getOwnProfile(): Promise<OwnProfileRow> {
  const session = await getSession();
  const supabase = createSupabaseServerClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, photo_url, phone")
    .eq("id", session.userId)
    .single();
  if (error) throw error;

  // Pull email from auth context. supabase.auth.getUser() is already cached
  // for this request via the SSR client.
  const { data: { user } } = await supabase.auth.getUser();
  return {
    ...(profile as { id: string; full_name: string | null; role: OwnProfileRow["role"]; photo_url: string | null; phone: string | null }),
    email: user?.email ?? null,
  };
}

export type OwnStableRow = {
  id:    string;
  name:  string;
  slug:  string | null;
};

/** Returns the stable the caller belongs to. RLS narrows to one row. */
export async function getOwnStable(): Promise<OwnStableRow | null> {
  const session = await getSession();
  void session;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("stables")
    .select("id, name, slug")
    .single();
  if (error) return null;
  return data as OwnStableRow;
}

// =================================================================
// Activity summary — role-aware "what have you done lately?" panel
// surfaced on /dashboard/settings/profile.
//
// The shape adapts to who's asking:
//   * owner / employee — lessons led, sessions logged, total minutes
//     ridden/coached, distinct horses + clients touched.
//   * client           — lessons taken, distinct horses ridden,
//                        upcoming bookings, total minutes in saddle.
//
// All counts are over the trailing 365 days. Rationale: long enough
// to be motivating for newer Founding 15 stables (rarely flat-zero
// in a year), short enough that an old account doesn't see lifetime
// numbers that no longer reflect current usage.
//
// Numbers come straight from RLS-scoped queries — no SECURITY DEFINER
// needed because every caller can only see their own data anyway.
// =================================================================
export type StaffActivity = {
  kind:            "staff";
  windowDays:      number;
  lessonsLed:      number;
  sessionsLogged:  number;
  minutesCoached:  number;
  distinctHorses:  number;
  distinctClients: number;
  upcomingLessons: number;
};

export type ClientActivity = {
  kind:            "client";
  windowDays:      number;
  lessonsTaken:    number;
  distinctHorses:  number;
  minutesRidden:   number;
  upcomingLessons: number;
};

export type ActivitySummary = StaffActivity | ClientActivity;

export async function getOwnActivityStats(): Promise<ActivitySummary> {
  const session = await getSession();
  const supabase = createSupabaseServerClient();

  const windowDays = 365;
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();
  const now   = new Date().toISOString();

  if (session.role === "client") {
    // Lessons attended in the last year + upcoming. RLS already narrows
    // lessons to "client_id = me", so no extra WHERE on client_id needed.
    const [completedRes, upcomingRes] = await Promise.all([
      supabase
        .from("lessons")
        .select("id, horse_id, starts_at, ends_at, status")
        .gte("starts_at", since)
        .lt("starts_at", now)
        .in("status", ["completed", "no_show"]),
      supabase
        .from("lessons")
        .select("id", { count: "exact", head: true })
        .gte("starts_at", now)
        .eq("status", "scheduled"),
    ]);

    const rows = (completedRes.data ?? []) as Array<{
      id: string; horse_id: string | null; starts_at: string; ends_at: string; status: string;
    }>;
    const horseIds = new Set<string>();
    let minutes = 0;
    let lessonsTaken = 0;
    for (const r of rows) {
      if (r.status !== "completed") continue;
      lessonsTaken += 1;
      if (r.horse_id) horseIds.add(r.horse_id);
      const m = Math.max(
        0,
        Math.round((Date.parse(r.ends_at) - Date.parse(r.starts_at)) / 60_000),
      );
      minutes += m;
    }

    return {
      kind:            "client",
      windowDays,
      lessonsTaken,
      distinctHorses:  horseIds.size,
      minutesRidden:   minutes,
      upcomingLessons: upcomingRes.count ?? 0,
    };
  }

  // Staff (owner + employee): lessons where they're the trainer + their
  // own coached sessions log + roll-up over the past year.
  const [lessonsRes, sessionsRes, upcomingRes] = await Promise.all([
    supabase
      .from("lessons")
      .select("id, horse_id, client_id, starts_at, ends_at, status")
      .eq("trainer_id", session.userId)
      .gte("starts_at", since)
      .lt("starts_at", now)
      .in("status", ["completed", "no_show"]),
    supabase
      .from("sessions")
      .select("id, started_at, duration_minutes, horse_id, rider_client_id")
      .eq("trainer_id", session.userId)
      .gte("started_at", since),
    supabase
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", session.userId)
      .gte("starts_at", now)
      .eq("status", "scheduled"),
  ]);

  const lessonRows = (lessonsRes.data ?? []) as Array<{
    id: string; horse_id: string | null; client_id: string | null;
    starts_at: string; ends_at: string; status: string;
  }>;
  const sessionRows = (sessionsRes.data ?? []) as Array<{
    id: string; started_at: string; duration_minutes: number | null;
    horse_id: string | null; rider_client_id: string | null;
  }>;

  const horseIds  = new Set<string>();
  const clientIds = new Set<string>();
  let lessonsLed = 0;
  let minutes    = 0;

  for (const r of lessonRows) {
    if (r.status !== "completed") continue;
    lessonsLed += 1;
    if (r.horse_id)  horseIds.add(r.horse_id);
    if (r.client_id) clientIds.add(r.client_id);
    minutes += Math.max(
      0,
      Math.round((Date.parse(r.ends_at) - Date.parse(r.starts_at)) / 60_000),
    );
  }
  for (const s of sessionRows) {
    if (s.horse_id)        horseIds.add(s.horse_id);
    if (s.rider_client_id) clientIds.add(s.rider_client_id);
    if (s.duration_minutes && s.duration_minutes > 0) {
      minutes += s.duration_minutes;
    }
  }

  return {
    kind:            "staff",
    windowDays,
    lessonsLed,
    sessionsLogged:  sessionRows.length,
    minutesCoached:  minutes,
    distinctHorses:  horseIds.size,
    distinctClients: clientIds.size,
    upcomingLessons: upcomingRes.count ?? 0,
  };
}

export async function updateOwnProfile(input: {
  fullName?: string;
  photoUrl?: string | null;
  phone?: string | null;
}) {
  const session = await getSession();
  const update: Record<string, unknown> = {};

  if (input.fullName !== undefined) {
    const trimmed = input.fullName.trim();
    if (trimmed.length < 1)  throw new Error("FULL_NAME_REQUIRED");
    if (trimmed.length > 80) throw new Error("FULL_NAME_TOO_LONG");
    update.full_name = trimmed;
  }
  if (input.photoUrl !== undefined) {
    const v = input.photoUrl?.trim();
    update.photo_url = !v ? null : v;
  }
  if (input.phone !== undefined) {
    const v = input.phone?.trim();
    update.phone = !v ? null : v;
  }

  if (Object.keys(update).length === 0) return;

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", session.userId);
  if (error) throw error;
}
