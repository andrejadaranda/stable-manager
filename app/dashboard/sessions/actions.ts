"use server";

import { revalidatePath } from "next/cache";
import {
  createSession,
  updateSession,
  deleteSession,
  SESSION_TYPES,
  type SessionType,
} from "@/services/sessions";

// =============================================================
// Create
// =============================================================
export type CreateSessionState = { error: string | null; success: boolean };

export async function createSessionAction(
  _prev: CreateSessionState,
  formData: FormData,
): Promise<CreateSessionState> {
  const horseId          = String(formData.get("horse_id") ?? "");
  const riderClientId    = String(formData.get("rider_client_id") ?? "") || undefined;
  const riderNameRaw     = String(formData.get("rider_name") ?? "").trim();
  const durationRaw      = String(formData.get("duration_minutes") ?? "").trim();
  const typeRaw          = String(formData.get("type") ?? "flat");
  const notesRaw         = String(formData.get("notes") ?? "").trim();
  const ratingRaw        = String(formData.get("rating") ?? "").trim();
  const startedAtRaw     = String(formData.get("started_at") ?? "").trim();

  if (!horseId) return { error: "Pick a horse.", success: false };
  if (!SESSION_TYPES.includes(typeRaw as SessionType)) {
    return { error: "Invalid session type.", success: false };
  }

  const duration = Number(durationRaw);
  if (!Number.isFinite(duration) || duration < 1 || duration > 600) {
    return { error: "Duration must be between 1 and 600 minutes.", success: false };
  }

  let rating: number | undefined;
  if (ratingRaw !== "") {
    const r = Number(ratingRaw);
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      return { error: "Rating must be 1–5.", success: false };
    }
    rating = r;
  }

  if (!riderClientId && !riderNameRaw) {
    return { error: "Add a rider — pick a client or type a name.", success: false };
  }

  // Optional started_at — accept HTML datetime-local format.
  let startedAt: string | undefined;
  if (startedAtRaw) {
    const d = new Date(startedAtRaw);
    if (Number.isNaN(d.getTime())) {
      return { error: "Invalid date / time.", success: false };
    }
    startedAt = d.toISOString();
  }

  try {
    await createSession({
      horseId,
      riderClientId,
      riderNameFreeform: riderNameRaw || undefined,
      durationMinutes: duration,
      type: typeRaw as SessionType,
      notes: notesRaw || undefined,
      rating,
      startedAt,
    });
  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : "";
    if (m === "FORBIDDEN")       return { error: "You don't have permission to log sessions.", success: false };
    if (m === "UNAUTHENTICATED") return { error: "Session expired. Sign in again.",            success: false };
    if (m === "MISSING_RIDER")   return { error: "Add a rider.",                                success: false };
    return { error: `Could not log session: ${m || "unknown error"}.`, success: false };
  }

  revalidatePath("/dashboard/sessions");
  revalidatePath(`/dashboard/horses/${horseId}`);
  revalidatePath("/dashboard");
  return { error: null, success: true };
}

// =============================================================
// Update
// =============================================================
export type UpdateSessionState = { error: string | null; success: boolean };

export async function updateSessionAction(
  _prev: UpdateSessionState,
  formData: FormData,
): Promise<UpdateSessionState> {
  const id          = String(formData.get("session_id") ?? "");
  const durationRaw = String(formData.get("duration_minutes") ?? "").trim();
  const typeRaw     = String(formData.get("type") ?? "");
  const notesRaw    = String(formData.get("notes") ?? "");
  const ratingRaw   = String(formData.get("rating") ?? "").trim();

  if (!id) return { error: "Missing session id.", success: false };
  if (!SESSION_TYPES.includes(typeRaw as SessionType)) {
    return { error: "Invalid session type.", success: false };
  }

  let duration: number | undefined;
  if (durationRaw !== "") {
    const d = Number(durationRaw);
    if (!Number.isFinite(d) || d < 1 || d > 600) {
      return { error: "Duration must be 1–600 minutes.", success: false };
    }
    duration = d;
  }

  let rating: number | null = null;
  if (ratingRaw !== "") {
    const r = Number(ratingRaw);
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      return { error: "Rating must be 1–5.", success: false };
    }
    rating = r;
  }

  try {
    await updateSession(id, {
      durationMinutes: duration,
      type: typeRaw as SessionType,
      notes: notesRaw.trim() === "" ? null : notesRaw.trim(),
      rating,
    });
  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : "";
    if (m === "FORBIDDEN")       return { error: "You don't have permission to edit sessions.", success: false };
    if (m === "UNAUTHENTICATED") return { error: "Session expired. Sign in again.",             success: false };
    return { error: `Could not update session: ${m || "unknown error"}.`, success: false };
  }

  revalidatePath("/dashboard/sessions");
  return { error: null, success: true };
}

// =============================================================
// Delete
// =============================================================
export type DeleteSessionState = { error: string | null; success: boolean };

export async function deleteSessionAction(
  _prev: DeleteSessionState,
  formData: FormData,
): Promise<DeleteSessionState> {
  const id = String(formData.get("session_id") ?? "");
  if (!id) return { error: "Missing session id.", success: false };

  try {
    await deleteSession(id);
  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : "";
    if (m === "FORBIDDEN")       return { error: "You don't have permission to delete sessions.", success: false };
    if (m === "UNAUTHENTICATED") return { error: "Session expired. Sign in again.",               success: false };
    return { error: `Could not delete session: ${m || "unknown error"}.`, success: false };
  }

  revalidatePath("/dashboard/sessions");
  return { error: null, success: true };
}
