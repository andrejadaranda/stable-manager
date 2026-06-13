"use server";

// Anonymous guest endpoint. Bearer of a 'rider' token can log a ride on the
// horse the link is scoped to. Calls the SECURITY DEFINER RPC
// `record_guest_ride` which performs all auth + rate-limit checks.

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type GuestRideState = {
  error:   string | null;
  success: boolean;
};

const ERROR_COPY: Record<string, string> = {
  INVALID_TOKEN:    "This link looks invalid.",
  TOKEN_NOT_FOUND:  "This link no longer works.",
  WRONG_TOKEN_KIND: "This link isn't a ride-logging link.",
  TOKEN_REVOKED:    "The horse owner revoked this link.",
  TOKEN_EXPIRED:    "This link has expired. Ask the owner for a new one.",
  INVALID_DATE:     "Add the date and time of the ride.",
  INVALID_DURATION: "Add how long you rode (1–600 minutes).",
  RATE_LIMIT:       "Too many rides logged on this link recently — please wait an hour.",
};

export async function submitGuestRideAction(
  token: string,
  _prev: GuestRideState,
  formData: FormData,
): Promise<GuestRideState> {
  const date      = String(formData.get("date") ?? "").trim();
  const time      = String(formData.get("time") ?? "").trim();
  const duration  = parseInt(String(formData.get("duration") ?? "0"), 10);
  const type      = String(formData.get("type") ?? "flat");
  const notes     = String(formData.get("notes") ?? "").trim();
  const ratingRaw = String(formData.get("rating") ?? "").trim();

  if (!date || !time) return { error: ERROR_COPY.INVALID_DATE, success: false };
  if (!Number.isFinite(duration) || duration < 1 || duration > 600) {
    return { error: ERROR_COPY.INVALID_DURATION, success: false };
  }

  // Wall-clock (Europe/Vilnius) → UTC instant — same conversion as the
  // client request action, so the stored time matches what was typed.
  const asUtc = new Date(`${date}T${time}:00Z`);
  if (!Number.isFinite(asUtc.getTime())) return { error: ERROR_COPY.INVALID_DATE, success: false };
  const vilniusStr = asUtc.toLocaleString("sv-SE", {
    timeZone: "Europe/Vilnius",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const offsetMs = new Date(vilniusStr.replace(" ", "T") + "Z").getTime() - asUtc.getTime();
  const startedAt = new Date(asUtc.getTime() - offsetMs).toISOString();

  const rating = ratingRaw ? parseInt(ratingRaw, 10) : null;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("record_guest_ride", {
    p_token:      token,
    p_started_at: startedAt,
    p_duration:   duration,
    p_type:       type,
    p_notes:      notes === "" ? null : notes,
    p_rating:     rating,
  });

  if (error) {
    const raw  = (error.message ?? "").replace(/^ERROR:\s*/, "").trim();
    const copy = ERROR_COPY[raw] ?? `Could not save: ${raw || "unknown error"}.`;
    return { error: copy, success: false };
  }
  return { error: null, success: true };
}
