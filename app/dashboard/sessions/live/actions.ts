"use server";

// Server actions for the live ride tracker.
// Thin wrappers around services/sessionTracking — each action does:
//   1. validate inputs
//   2. translate to service call
//   3. translate errors to user-facing strings
//   4. revalidate the affected paths

import { revalidatePath } from "next/cache";
import {
  startLiveSession,
  appendTrackPoints,
  finalizeLiveSession,
  abandonLiveSession,
  type TrackPointInput,
} from "@/services/sessionTracking";
import { SESSION_TYPES, type SessionType } from "@/services/sessions.types";

// ---------------- START ----------------

export type StartLiveState = {
  error:     string | null;
  sessionId: string | null;
  resumeId:  string | null;   // if there's an unfinished live session already
};

export async function startLiveAction(
  _prev: StartLiveState,
  formData: FormData,
): Promise<StartLiveState> {
  const horseId = String(formData.get("horse_id") ?? "").trim() || null;
  const typeRaw = String(formData.get("type") ?? "flat");

  if (!SESSION_TYPES.includes(typeRaw as SessionType)) {
    return { error: "Pick a session type.", sessionId: null, resumeId: null };
  }

  try {
    const { id } = await startLiveSession({
      horseId,
      type: typeRaw as SessionType,
    });
    revalidatePath("/dashboard/sessions");
    return { error: null, sessionId: id, resumeId: null };
  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : "";
    if (m.startsWith("LIVE_ALREADY_RUNNING:")) {
      return {
        error: "You already have a live ride in progress.",
        sessionId: null,
        resumeId: m.split(":")[1] ?? null,
      };
    }
    if (m === "FORBIDDEN")       return { error: "Not allowed.",             sessionId: null, resumeId: null };
    if (m === "UNAUTHENTICATED") return { error: "Sign in again.",           sessionId: null, resumeId: null };
    return { error: `Could not start ride: ${m || "unknown"}.`, sessionId: null, resumeId: null };
  }
}

// ---------------- APPEND POINTS ----------------
// Called by the client every ~10s while the ride is active. Lightweight
// JSON-body endpoint behaviour but invoked as a server action via the
// client component (we don't need the cross-origin baggage of a /api
// route for an in-app call).

export async function appendPointsAction(
  sessionId: string,
  points: TrackPointInput[],
): Promise<{ error: string | null; inserted: number }> {
  if (!sessionId) return { error: "Missing session id.", inserted: 0 };
  if (!Array.isArray(points) || points.length === 0) {
    return { error: null, inserted: 0 };
  }

  // Defensive cap — never trust client. 600 points = 100min @ 10s sampling.
  const safe = points.slice(0, 1000);

  try {
    const { inserted } = await appendTrackPoints(sessionId, safe);
    return { error: null, inserted };
  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : "";
    if (m === "SESSION_NOT_FOUND") return { error: "Ride lost.",      inserted: 0 };
    if (m === "SESSION_NOT_LIVE")  return { error: "Ride already ended.", inserted: 0 };
    if (m === "FORBIDDEN")         return { error: "Not your ride.",  inserted: 0 };
    return { error: `Could not save points: ${m || "unknown"}.`, inserted: 0 };
  }
}

// ---------------- FINALIZE ----------------

export type FinalizeLiveState = {
  error: string | null;
  done:  boolean;
};

export async function finalizeLiveAction(
  _prev: FinalizeLiveState,
  formData: FormData,
): Promise<FinalizeLiveState> {
  const sessionId = String(formData.get("session_id") ?? "");
  const notes     = String(formData.get("notes") ?? "").trim();
  const ratingRaw = String(formData.get("rating") ?? "").trim();
  const horseId   = String(formData.get("horse_id") ?? "").trim();

  if (!sessionId) return { error: "Missing session id.", done: false };

  let rating: number | null = null;
  if (ratingRaw !== "") {
    const r = Number(ratingRaw);
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      return { error: "Rating must be 1–5.", done: false };
    }
    rating = r;
  }

  try {
    await finalizeLiveSession(sessionId, {
      notes:   notes === "" ? null : notes,
      rating,
      horseId: horseId === "" ? undefined : horseId,
    });
  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : "";
    if (m === "SESSION_NOT_FOUND") return { error: "Ride not found.",      done: false };
    if (m === "SESSION_NOT_LIVE")  return { error: "Ride already ended.",  done: false };
    if (m === "FORBIDDEN")         return { error: "Not your ride.",       done: false };
    if (m === "UNAUTHENTICATED")   return { error: "Sign in again.",       done: false };
    return { error: `Could not save ride: ${m || "unknown"}.`, done: false };
  }

  revalidatePath("/dashboard/sessions");
  revalidatePath(`/dashboard/sessions/${sessionId}`);
  revalidatePath("/dashboard");
  return { error: null, done: true };
}

// ---------------- ABANDON ----------------

export async function abandonLiveAction(
  sessionId: string,
): Promise<{ error: string | null }> {
  if (!sessionId) return { error: "Missing session id." };
  try {
    await abandonLiveSession(sessionId);
    revalidatePath("/dashboard/sessions");
    return { error: null };
  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : "";
    return { error: `Could not abandon ride: ${m || "unknown"}.` };
  }
}
