"use server";

// Anonymous guest endpoint. Bearer of the token can record one health
// event. Calls the SECURITY DEFINER RPC `record_guest_health_event`
// which performs all auth + rate-limit checks server-side.

import { createSupabaseAdminClient } from "@/lib/supabase/server";

// IMPORTANT: A "use server" file can ONLY export async functions in
// Next 14. The initial-state literal lives inline in form.tsx.
export type GuestSubmitState = {
  error:    string | null;
  success:  boolean;
};

const ERROR_COPY: Record<string, string> = {
  INVALID_TOKEN:    "This link looks invalid.",
  TOKEN_NOT_FOUND:  "This link no longer works.",
  TOKEN_REVOKED:    "The stable owner revoked this link.",
  TOKEN_EXPIRED:    "This link has expired. Ask the stable for a new one.",
  INVALID_TITLE:    "Add a short summary of what you did.",
  TITLE_TOO_LONG:   "Summary must be 200 characters or fewer.",
  INVALID_DATE:     "Add the date of the visit.",
  RATE_LIMIT:       "Too many submissions on this link recently — please wait an hour.",
};

export async function submitGuestHealthEventAction(
  token: string,
  _prev: GuestSubmitState,
  formData: FormData,
): Promise<GuestSubmitState> {
  const title      = String(formData.get("title") ?? "").trim();
  const occurredOn = String(formData.get("occurred_on") ?? "").trim();
  const nextDueOn  = String(formData.get("next_due_on") ?? "").trim();
  const notesRaw   = String(formData.get("notes") ?? "").trim();

  if (!title)      return { error: ERROR_COPY.INVALID_TITLE,  success: false };
  if (!occurredOn) return { error: ERROR_COPY.INVALID_DATE,   success: false };

  // Use admin client because the caller is anonymous (no cookie); the
  // RPC is SECURITY DEFINER + token-gated, so this is safe.
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("record_guest_health_event", {
    p_token:        token,
    p_title:        title,
    p_occurred_on:  occurredOn,
    p_next_due_on:  nextDueOn === "" ? null : nextDueOn,
    p_notes:        notesRaw === "" ? null : notesRaw,
  });

  if (error) {
    // Postgres errors come through with the code in `.message`; strip
    // the leading "ERROR:" if present.
    const raw  = (error.message ?? "").replace(/^ERROR:\s*/, "").trim();
    const copy = ERROR_COPY[raw] ?? `Could not save: ${raw || "unknown error"}.`;
    return { error: copy, success: false };
  }

  return { error: null, success: true };
}
