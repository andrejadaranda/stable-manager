// Sessions V2 — live tracking service.
//
// Strava-for-equestrian. Owner / employee / personal accounts can:
//   1. startLiveSession()         — opens a session with status='live'.
//   2. appendTrackPoints(...)     — client batches GPS pts ~every 10s.
//   3. finalizeLiveSession(...)   — computes distance, speed, polyline,
//                                   gait breakdown; sets status='completed'.
//   4. abandonLiveSession(...)    — discards (status='abandoned').
//   5. getActiveLiveSession()     — resume after reload / app re-open.
//
// All writes go through Supabase with RLS active; the `force row level
// security` flag on session_tracks ensures even owner-context reads obey
// the membership check.
//
// Background tracking limitation: navigator.geolocation.watchPosition
// only fires while the tab is foreground + screen on. We use the Wake
// Lock API on the client to keep the screen awake during a ride. True
// background tracking ships with the native iOS app (summer 2026).

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";
import type { SessionType } from "./sessions.types";

// Pure helpers + their types live in sessionTracking.pure.ts so that
// client components (LiveTracker, SessionMap) can import them WITHOUT
// pulling next/headers into the client bundle. Re-exported here so
// server callers don't need to know about the split.
export {
  computeRollups,
  haversine,
  encodePolyline,
  decodePolyline,
  type TrackPointInput,
  type GaitBreakdown,
} from "./sessionTracking.pure";
import type { TrackPointInput, GaitBreakdown } from "./sessionTracking.pure";
import { computeRollups } from "./sessionTracking.pure";

// ---------------- TYPES ----------------

export type LiveSessionSummary = {
  id: string;
  startedAt: string;
  horseId: string | null;
  type: SessionType;
  pointCount: number;
};

export type FinalizeResult = {
  id: string;
  distance_m: number;
  elapsed_seconds: number;
  moving_seconds: number;
  avg_speed_kmh: number | null;
  max_speed_kmh: number | null;
  encoded_polyline: string;
  gait_breakdown: GaitBreakdown;
};

// ---------------- 1. START ----------------

/** Open a new live session and return its id. */
export async function startLiveSession(input: {
  horseId?: string | null;
  type: SessionType;
  lessonId?: string | null;
}): Promise<{ id: string }> {
  const ctx = await getSession();
  requireRole(ctx, "owner", "employee");

  // Refuse if this user already has a live session — they should resume
  // it or explicitly abandon before starting another.
  const existing = await getActiveLiveSession();
  if (existing) {
    throw new Error(`LIVE_ALREADY_RUNNING:${existing.id}`);
  }

  const supabase = createSupabaseServerClient();
  const horseId = input.horseId && input.horseId.trim() ? input.horseId.trim() : null;

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      stable_id:           ctx.stableId,
      horse_id:            horseId,
      // For owner/personal the user IS the rider; for employees doing their
      // own training ride likewise. We leave rider_client_id null — UI can
      // attribute to a client later if it was a lesson.
      rider_profile_id:    ctx.userId,
      trainer_id:          ctx.userId,
      lesson_id:           input.lessonId ?? null,
      started_at:          new Date().toISOString(),
      duration_minutes:    1,            // placeholder, replaced on finalize
      type:                input.type,
      status:              "live",
      tracking_device:     "web-pwa",
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id };
}

// ---------------- 2. APPEND POINTS ----------------

/** Batch-insert GPS points captured by the browser. Idempotent enough —
 *  duplicate timestamps will produce duplicate rows but finalize
 *  deduplicates by recorded_at when computing rollups. */
export async function appendTrackPoints(
  sessionId: string,
  points: TrackPointInput[],
): Promise<{ inserted: number }> {
  if (points.length === 0) return { inserted: 0 };
  const ctx = await getSession();
  requireRole(ctx, "owner", "employee");

  const supabase = createSupabaseServerClient();

  // Cheap auth guard — RLS would block anyway, but giving a clearer error.
  const { data: sess, error: sErr } = await supabase
    .from("sessions")
    .select("id, status, trainer_id, stable_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (sErr || !sess) throw new Error("SESSION_NOT_FOUND");
  if (sess.status !== "live") throw new Error("SESSION_NOT_LIVE");
  if (sess.trainer_id !== ctx.userId && ctx.role !== "owner") {
    throw new Error("FORBIDDEN");
  }

  const rows = points.map((p) => ({
    session_id:  sessionId,
    recorded_at: p.recordedAt,
    lat:         p.lat,
    lng:         p.lng,
    altitude_m:  p.altitude ?? null,
    accuracy_m:  p.accuracy ?? null,
    speed_mps:   p.speed    ?? null,
    heading_deg: p.heading  ?? null,
  }));

  const { error } = await supabase.from("session_tracks").insert(rows);
  if (error) throw error;

  // Bump the running point counter for UX feedback (cheap, optimistic).
  await supabase
    .from("sessions")
    .update({ tracking_points: (rows.length) + 0 }) // we accumulate below
    .eq("id", sessionId);

  // Read it back atomically: increment by N. We don't have RPC here so
  // do a fetch-then-write — race-safe enough for a single-writer scenario
  // (only the rider's own device writes to their session).
  const { data: cur } = await supabase
    .from("sessions")
    .select("tracking_points")
    .eq("id", sessionId)
    .single();
  if (cur) {
    await supabase
      .from("sessions")
      .update({ tracking_points: (cur.tracking_points ?? 0) + rows.length })
      .eq("id", sessionId);
  }

  return { inserted: rows.length };
}

// ---------------- 3. FINALIZE ----------------

/** Compute analytics, encode polyline, mark session completed. */
export async function finalizeLiveSession(
  sessionId: string,
  patch?: { notes?: string | null; rating?: number | null; horseId?: string | null },
): Promise<FinalizeResult> {
  const ctx = await getSession();
  requireRole(ctx, "owner", "employee");

  const supabase = createSupabaseServerClient();

  const { data: sess, error: sErr } = await supabase
    .from("sessions")
    .select("id, status, trainer_id, started_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (sErr || !sess) throw new Error("SESSION_NOT_FOUND");
  if (sess.status !== "live") throw new Error("SESSION_NOT_LIVE");
  if (sess.trainer_id !== ctx.userId && ctx.role !== "owner") {
    throw new Error("FORBIDDEN");
  }

  // Load all points in chronological order.
  const { data: pts, error: pErr } = await supabase
    .from("session_tracks")
    .select("recorded_at, lat, lng, speed_mps")
    .eq("session_id", sessionId)
    .order("recorded_at", { ascending: true });
  if (pErr) throw pErr;

  const rollups = computeRollups((pts ?? []).map((p) => ({
    t:     new Date(p.recorded_at).getTime(),
    lat:   Number(p.lat),
    lng:   Number(p.lng),
    speed: p.speed_mps == null ? null : Number(p.speed_mps),
  })));

  const finishedAt = new Date().toISOString();
  const durationMin = Math.max(1, Math.round(rollups.elapsed_seconds / 60));

  const update: Record<string, unknown> = {
    status:           "completed",
    finished_at:      finishedAt,
    distance_m:       rollups.distance_m,
    elapsed_seconds:  rollups.elapsed_seconds,
    moving_seconds:   rollups.moving_seconds,
    avg_speed_kmh:    rollups.avg_speed_kmh,
    max_speed_kmh:    rollups.max_speed_kmh,
    encoded_polyline: rollups.encoded_polyline,
    gait_breakdown:   rollups.gait_breakdown,
    duration_minutes: durationMin,
  };
  if (patch?.notes   !== undefined) update.notes   = patch.notes;
  if (patch?.rating  !== undefined) update.rating  = patch.rating;
  if (patch?.horseId !== undefined) update.horse_id = patch.horseId;

  const { error } = await supabase
    .from("sessions")
    .update(update)
    .eq("id", sessionId);
  if (error) throw error;

  return {
    id:               sessionId,
    distance_m:       rollups.distance_m,
    elapsed_seconds:  rollups.elapsed_seconds,
    moving_seconds:   rollups.moving_seconds,
    avg_speed_kmh:    rollups.avg_speed_kmh,
    max_speed_kmh:    rollups.max_speed_kmh,
    encoded_polyline: rollups.encoded_polyline,
    gait_breakdown:   rollups.gait_breakdown,
  };
}

// ---------------- 4. ABANDON ----------------

export async function abandonLiveSession(sessionId: string): Promise<void> {
  const ctx = await getSession();
  requireRole(ctx, "owner", "employee");

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("sessions")
    .update({ status: "abandoned", finished_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("status", "live")
    .or(`trainer_id.eq.${ctx.userId},stable_id.eq.${ctx.stableId}`);
  if (error) throw error;
}

// ---------------- 5. RESUME ----------------

/** Return the caller's currently-running live session if any (used on
 *  page load to offer a "Resume tracking" UI). */
export async function getActiveLiveSession(): Promise<LiveSessionSummary | null> {
  const ctx = await getSession();
  if (!["owner", "employee"].includes(ctx.role)) return null;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("id, started_at, horse_id, type, tracking_points")
    .eq("trainer_id", ctx.userId)
    .eq("status", "live")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    id:         data.id,
    startedAt:  data.started_at,
    horseId:    data.horse_id,
    type:       data.type as SessionType,
    pointCount: data.tracking_points ?? 0,
  };
}

// =============================================================
// PURE HELPERS moved to ./sessionTracking.pure.ts so client
// components can import them without next/headers bleed.
// Re-exported at the top of this file.
// =============================================================
