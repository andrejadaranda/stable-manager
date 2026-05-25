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

// ---------------- TYPES ----------------

export type TrackPointInput = {
  /** ISO timestamp of when the GPS fix happened on the device. */
  recordedAt: string;
  lat: number;
  lng: number;
  /** Meters above WGS84 ellipsoid (optional, often null indoors). */
  altitude?: number | null;
  /** GPS accuracy in meters (lower = better). */
  accuracy?: number | null;
  /** Speed in m/s straight from the geolocation API. */
  speed?: number | null;
  /** Heading degrees true-north (optional). */
  heading?: number | null;
};

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

export type GaitBreakdown = {
  walk_s: number;     // <  7 km/h
  trot_s: number;     // 7–17
  canter_s: number;   // 17–30
  gallop_s: number;   // 30+
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
// PURE HELPERS — exported for tests + reuse in client preview UI
// =============================================================

type PointMs = { t: number; lat: number; lng: number; speed: number | null };

type Rollups = {
  distance_m: number;
  elapsed_seconds: number;
  moving_seconds: number;
  avg_speed_kmh: number | null;
  max_speed_kmh: number | null;
  encoded_polyline: string;
  gait_breakdown: GaitBreakdown;
};

/** Compute distance via Haversine, splits, polyline + gait buckets.
 *  Pure — does no IO. Exported so the live client can preview live
 *  distance + speed without round-tripping the server. */
export function computeRollups(points: PointMs[]): Rollups {
  if (points.length === 0) {
    return {
      distance_m: 0,
      elapsed_seconds: 0,
      moving_seconds: 0,
      avg_speed_kmh: null,
      max_speed_kmh: null,
      encoded_polyline: "",
      gait_breakdown: { walk_s: 0, trot_s: 0, canter_s: 0, gallop_s: 0 },
    };
  }

  let distance = 0;
  let maxSpeedMps = 0;
  let movingMs = 0;
  const gaits: GaitBreakdown = { walk_s: 0, trot_s: 0, canter_s: 0, gallop_s: 0 };

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dMeters = haversine(a.lat, a.lng, b.lat, b.lng);
    const dtMs = b.t - a.t;
    if (dtMs <= 0) continue;

    distance += dMeters;

    // Speed: prefer the GPS-reported speed when available (it's more
    // accurate than diff/dt on short legs), otherwise derive.
    const speedMps = b.speed != null && Number.isFinite(b.speed) && b.speed >= 0
      ? b.speed
      : (dMeters / (dtMs / 1000));

    if (speedMps > maxSpeedMps) maxSpeedMps = speedMps;

    // "Moving" = above 0.5 m/s (~1.8 km/h) — filters out fidget / GPS jitter
    // while standing.
    const segSec = dtMs / 1000;
    if (speedMps > 0.5) movingMs += dtMs;

    // Bucket the segment time into the corresponding gait by speed kmh.
    const kmh = speedMps * 3.6;
    if      (kmh < 7)  gaits.walk_s   += segSec;
    else if (kmh < 17) gaits.trot_s   += segSec;
    else if (kmh < 30) gaits.canter_s += segSec;
    else               gaits.gallop_s += segSec;
  }

  const elapsedMs = points[points.length - 1].t - points[0].t;
  const elapsedSec = Math.round(elapsedMs / 1000);
  const movingSec  = Math.round(movingMs / 1000);

  const avgKmh = movingSec > 0
    ? Number(((distance / movingSec) * 3.6).toFixed(2))
    : null;
  const maxKmh = maxSpeedMps > 0
    ? Number((maxSpeedMps * 3.6).toFixed(2))
    : null;

  // Downsample for polyline storage — keep at most 1 pt every 3 seconds
  // to keep the stored string small while preserving route shape.
  const polyPts: Array<{ lat: number; lng: number }> = [];
  let lastT = -Infinity;
  for (const p of points) {
    if (p.t - lastT >= 3000) {
      polyPts.push({ lat: p.lat, lng: p.lng });
      lastT = p.t;
    }
  }
  if (polyPts.length === 0 && points.length > 0) {
    polyPts.push({ lat: points[0].lat, lng: points[0].lng });
  }
  const encoded = encodePolyline(polyPts);

  return {
    distance_m:       Math.round(distance),
    elapsed_seconds:  elapsedSec,
    moving_seconds:   movingSec,
    avg_speed_kmh:    avgKmh,
    max_speed_kmh:    maxKmh,
    encoded_polyline: encoded,
    gait_breakdown: {
      walk_s:   Math.round(gaits.walk_s),
      trot_s:   Math.round(gaits.trot_s),
      canter_s: Math.round(gaits.canter_s),
      gallop_s: Math.round(gaits.gallop_s),
    },
  };
}

/** Great-circle distance in meters (Earth radius 6371008.8m, WGS84 mean). */
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Google encoded polyline (precision 5). Compact route storage that
 *  every map library — Leaflet, Mapbox, Google Maps — can decode. */
export function encodePolyline(points: Array<{ lat: number; lng: number }>): string {
  let out = "";
  let prevLat = 0;
  let prevLng = 0;
  for (const p of points) {
    const lat = Math.round(p.lat * 1e5);
    const lng = Math.round(p.lng * 1e5);
    out += encodeValue(lat - prevLat) + encodeValue(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return out;
}

function encodeValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : (value << 1);
  let out = "";
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  out += String.fromCharCode(v + 63);
  return out;
}

/** Inverse — used by the detail page to feed Leaflet. */
export function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const out: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0; result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    out.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return out;
}
