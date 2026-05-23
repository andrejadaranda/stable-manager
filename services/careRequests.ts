// =============================================================
// Care requests — horse-owner clients ask the stable to arrange a
// service for their horse (farrier, vet, feed top-up, equipment,
// transport, "other"). RLS does the heavy lifting:
//
//   * care_requests_owner_all              — owner/employee CRUD
//   * care_requests_client_select_own      — horse-owner reads own
//   * care_requests_client_insert_own      — horse-owner creates for their horse
//   * care_requests_client_update_pending  — horse-owner cancels/edits while pending
//   * care_requests_client_field_lock      — trigger blocks owner-only fields
//   * care_requests_auto_response_stamp    — trigger fills responded_at/by
// =============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import type {
  CareRequestType,
  CareRequestUrgency,
  CareRequestStatus,
  CareRequestRow,
  CareRequestWithContext,
} from "./careRequests.types";

// Re-export types + presentation maps from the client-safe sibling file
// so existing server-side imports keep working without churn.
export type {
  CareRequestType,
  CareRequestUrgency,
  CareRequestStatus,
  CareRequestRow,
  CareRequestWithContext,
} from "./careRequests.types";
export {
  CARE_TYPE_LABEL,
  CARE_TYPE_EMOJI,
  URGENCY_LABEL,
  STATUS_LABEL,
} from "./careRequests.types";

// CareRequestRow + CareRequestWithContext are defined in careRequests.types.ts
// and re-exported at the top of this file for server-side callers.

// =============================================================
// CLIENT-side reads (horse-owner viewing their own history)
// =============================================================

/** All care requests this client has submitted on a given horse. */
export async function listCareRequestsForHorse(horseId: string): Promise<CareRequestRow[]> {
  const session = await getSession();
  if (session.role !== "client") throw new Error("FORBIDDEN");
  if (!session.clientId) throw new Error("CLIENT_NOT_LINKED");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("care_requests")
    .select("*")
    .eq("horse_id", horseId)
    .eq("requester_client_id", session.clientId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []) as CareRequestRow[];
}

// =============================================================
// OWNER-side reads (stable inbox)
// =============================================================

/** Owner inbox — every request across the stable, joined with horse + requester. */
export async function listCareRequestsForOwner(opts?: {
  status?: CareRequestStatus | "open";  // "open" = pending|acknowledged|scheduled
  limit?:  number;
}): Promise<CareRequestWithContext[]> {
  const session = await getSession();
  if (session.role !== "owner" && session.role !== "employee") throw new Error("FORBIDDEN");

  const supabase = createSupabaseServerClient();
  let q = supabase
    .from("care_requests")
    .select(`
      *,
      horse:horses(name),
      requester:clients(full_name)
    `)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 100);

  if (opts?.status === "open") {
    q = q.in("status", ["pending", "acknowledged", "scheduled"]);
  } else if (opts?.status) {
    q = q.eq("status", opts.status);
  }

  const { data, error } = await q;
  if (error) throw error;

  return ((data ?? []) as Array<CareRequestRow & {
    horse:     { name: string } | null;
    requester: { full_name: string } | null;
  }>).map((r) => ({
    id:                  r.id,
    stable_id:           r.stable_id,
    horse_id:            r.horse_id,
    requester_client_id: r.requester_client_id,
    type:                r.type,
    urgency:             r.urgency,
    preferred_date:      r.preferred_date,
    notes:               r.notes,
    status:              r.status,
    owner_response:      r.owner_response,
    responded_by:        r.responded_by,
    responded_at:        r.responded_at,
    scheduled_for:       r.scheduled_for,
    created_at:          r.created_at,
    updated_at:          r.updated_at,
    horse_name:          r.horse?.name ?? "—",
    requester_name:      r.requester?.full_name ?? null,
  }));
}

/** Fast count for owner dashboard widget — just open (actionable) requests. */
export async function countOpenCareRequests(): Promise<number> {
  const session = await getSession();
  if (session.role !== "owner" && session.role !== "employee") return 0;

  const supabase = createSupabaseServerClient();
  const { count, error } = await supabase
    .from("care_requests")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "acknowledged", "scheduled"]);

  if (error) throw error;
  return count ?? 0;
}

// =============================================================
// CLIENT writes
// =============================================================

export type CreateCareRequestInput = {
  horseId:       string;
  type:          CareRequestType;
  urgency?:      CareRequestUrgency;
  preferredDate?: string | null;  // YYYY-MM-DD
  notes?:        string | null;
};

export async function createCareRequest(input: CreateCareRequestInput): Promise<CareRequestRow> {
  const session = await getSession();
  if (session.role !== "client") throw new Error("FORBIDDEN");
  if (!session.clientId) throw new Error("CLIENT_NOT_LINKED");

  const supabase = createSupabaseServerClient();

  // Look up the horse's stable + ownership so RLS+app agree before insert.
  const { data: horse, error: hErr } = await supabase
    .from("horses")
    .select("id, stable_id, owner_client_id")
    .eq("id", input.horseId)
    .maybeSingle();
  if (hErr) throw hErr;
  if (!horse)                                       throw new Error("HORSE_NOT_FOUND");
  if (horse.owner_client_id !== session.clientId)   throw new Error("FORBIDDEN");

  const notes = (input.notes ?? "").trim();

  const { data, error } = await supabase
    .from("care_requests")
    .insert({
      stable_id:           horse.stable_id,
      horse_id:            horse.id,
      requester_client_id: session.clientId,
      type:                input.type,
      urgency:             input.urgency ?? "normal",
      preferred_date:      input.preferredDate || null,
      notes:               notes.length > 0 ? notes : null,
      status:              "pending",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as CareRequestRow;
}

/** Client cancels their own pending request via DELETE
 *  (migration 51 adds care_requests_client_delete_pending). */
export async function cancelCareRequest(requestId: string): Promise<void> {
  const session = await getSession();
  if (session.role !== "client") throw new Error("FORBIDDEN");
  if (!session.clientId) throw new Error("CLIENT_NOT_LINKED");

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("care_requests")
    .delete()
    .eq("id", requestId)
    .eq("requester_client_id", session.clientId)
    .eq("status", "pending");

  if (error) throw error;
}

// =============================================================
// OWNER writes
// =============================================================

export type RespondToCareRequestInput = {
  requestId:    string;
  status:       Exclude<CareRequestStatus, "pending">;
  response?:    string | null;
  scheduledFor?: string | null;  // YYYY-MM-DD
};

export async function respondToCareRequest(input: RespondToCareRequestInput): Promise<void> {
  const session = await getSession();
  if (session.role !== "owner" && session.role !== "employee") throw new Error("FORBIDDEN");

  const update: Record<string, unknown> = { status: input.status };
  if (input.response !== undefined) {
    const t = (input.response ?? "").trim();
    update.owner_response = t.length > 0 ? t : null;
  }
  if (input.scheduledFor !== undefined) {
    update.scheduled_for = input.scheduledFor || null;
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("care_requests")
    .update(update)
    .eq("id", input.requestId);

  if (error) throw error;
}

// Presentation helpers (CARE_TYPE_LABEL etc.) live in careRequests.types.ts
// and are re-exported from this file's header to keep the public API stable.
