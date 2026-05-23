// =============================================================
// Lesson requests — clients propose a lesson date/time/horse;
// owner or trainer accepts to materialize a real lessons row.
//
// RLS does the visibility split (owner sees stable, client sees own).
// State changes go through SECURITY DEFINER RPCs:
//   - accept_lesson_request : creates lessons row, marks accepted
//   - decline_lesson_request : marks declined with reason
// Cancel by the client is a plain DELETE on a pending row
// (lesson_requests_client_delete_pending policy).
// =============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

export type LessonRequestStatus = "pending" | "accepted" | "declined" | "cancelled";

export type LessonRequestRow = {
  id:                     string;
  stable_id:              string;
  requester_client_id:    string;
  horse_id:               string | null;
  preferred_trainer_id:   string | null;
  requested_start:        string;       // ISO timestamp
  requested_duration_min: number;
  notes:                  string | null;
  status:                 LessonRequestStatus;
  accepted_lesson_id:     string | null;
  decline_reason:         string | null;
  responded_by:           string | null;
  responded_at:           string | null;
  created_at:             string;
  updated_at:             string;
};

export type LessonRequestWithContext = LessonRequestRow & {
  horse_name:             string | null;
  preferred_trainer_name: string | null;
  requester_name:         string | null;
};

// =============================================================
// Reads
// =============================================================

export async function listLessonRequestsForClient(): Promise<LessonRequestWithContext[]> {
  const session = await getSession();
  if (session.role !== "client") throw new Error("FORBIDDEN");
  if (!session.clientId) throw new Error("CLIENT_NOT_LINKED");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("lesson_requests")
    .select(`
      *,
      horse:horses(name),
      preferred_trainer:profiles!lesson_requests_preferred_trainer_id_fkey(full_name)
    `)
    .eq("requester_client_id", session.clientId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return ((data ?? []) as Array<LessonRequestRow & {
    horse:             { name: string } | null;
    preferred_trainer: { full_name: string } | null;
  }>).map(flattenContext);
}

export async function listLessonRequestsForOwner(opts?: {
  status?: LessonRequestStatus | "open";  // "open" = pending only here
  limit?:  number;
}): Promise<LessonRequestWithContext[]> {
  const session = await getSession();
  if (session.role !== "owner" && session.role !== "employee") throw new Error("FORBIDDEN");

  const supabase = createSupabaseServerClient();
  let q = supabase
    .from("lesson_requests")
    .select(`
      *,
      horse:horses(name),
      preferred_trainer:profiles!lesson_requests_preferred_trainer_id_fkey(full_name),
      requester:clients(full_name)
    `)
    .order("requested_start", { ascending: true })
    .limit(opts?.limit ?? 100);

  if (opts?.status === "open") {
    q = q.eq("status", "pending");
  } else if (opts?.status) {
    q = q.eq("status", opts.status);
  }

  const { data, error } = await q;
  if (error) throw error;

  return ((data ?? []) as Array<LessonRequestRow & {
    horse:             { name: string } | null;
    preferred_trainer: { full_name: string } | null;
    requester:         { full_name: string } | null;
  }>).map(flattenContext);
}

export async function countOpenLessonRequests(): Promise<number> {
  const session = await getSession();
  if (session.role !== "owner" && session.role !== "employee") return 0;

  const supabase = createSupabaseServerClient();
  const { count, error } = await supabase
    .from("lesson_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  if (error) throw error;
  return count ?? 0;
}

// =============================================================
// Client writes
// =============================================================

export type CreateLessonRequestInput = {
  stableId:           string;       // explicit — client may belong to one stable but we send it for safety
  horseId?:           string | null;
  preferredTrainerId?: string | null;
  requestedStart:     string;       // ISO
  requestedDuration?: number;       // minutes
  notes?:             string | null;
};

export async function createLessonRequest(input: CreateLessonRequestInput): Promise<LessonRequestRow> {
  const session = await getSession();
  if (session.role !== "client") throw new Error("FORBIDDEN");
  if (!session.clientId) throw new Error("CLIENT_NOT_LINKED");

  const dur = Math.max(15, Math.min(240, input.requestedDuration ?? 60));
  const notes = (input.notes ?? "").trim();

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("lesson_requests")
    .insert({
      stable_id:              input.stableId,
      requester_client_id:    session.clientId,
      horse_id:               input.horseId ?? null,
      preferred_trainer_id:   input.preferredTrainerId ?? null,
      requested_start:        input.requestedStart,
      requested_duration_min: dur,
      notes:                  notes.length > 0 ? notes : null,
      status:                 "pending",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as LessonRequestRow;
}

export async function cancelLessonRequest(requestId: string): Promise<void> {
  const session = await getSession();
  if (session.role !== "client") throw new Error("FORBIDDEN");
  if (!session.clientId) throw new Error("CLIENT_NOT_LINKED");

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("lesson_requests")
    .delete()
    .eq("id", requestId)
    .eq("requester_client_id", session.clientId)
    .eq("status", "pending");

  if (error) throw error;
}

// =============================================================
// Owner writes (via RPC)
// =============================================================

export type AcceptLessonRequestInput = {
  requestId: string;
  horseId:   string;
  trainerId: string;
  startsAt:  string;          // ISO
  duration?: number | null;   // override duration; null/undef = use request's value
  price?:    number | null;
};

export async function acceptLessonRequest(input: AcceptLessonRequestInput): Promise<string> {
  const session = await getSession();
  if (session.role !== "owner" && session.role !== "employee") throw new Error("FORBIDDEN");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("accept_lesson_request", {
    p_request_id: input.requestId,
    p_horse_id:   input.horseId,
    p_trainer_id: input.trainerId,
    p_starts_at:  input.startsAt,
    p_duration:   input.duration ?? null,
    p_price:      input.price    ?? 0,
  });

  if (error) throw error;
  return data as string;  // new lesson id
}

export async function declineLessonRequest(requestId: string, reason?: string | null): Promise<void> {
  const session = await getSession();
  if (session.role !== "owner" && session.role !== "employee") throw new Error("FORBIDDEN");

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("decline_lesson_request", {
    p_request_id: requestId,
    p_reason:     reason ?? null,
  });

  if (error) throw error;
}

// =============================================================
// Helpers
// =============================================================

export const LESSON_STATUS_LABEL: Record<LessonRequestStatus, string> = {
  pending:   "Pending",
  accepted:  "Accepted",
  declined:  "Declined",
  cancelled: "Cancelled",
};

function flattenContext(r: LessonRequestRow & {
  horse?:             { name: string } | null;
  preferred_trainer?: { full_name: string } | null;
  requester?:         { full_name: string } | null;
}): LessonRequestWithContext {
  return {
    id:                     r.id,
    stable_id:              r.stable_id,
    requester_client_id:    r.requester_client_id,
    horse_id:               r.horse_id,
    preferred_trainer_id:   r.preferred_trainer_id,
    requested_start:        r.requested_start,
    requested_duration_min: r.requested_duration_min,
    notes:                  r.notes,
    status:                 r.status,
    accepted_lesson_id:     r.accepted_lesson_id,
    decline_reason:         r.decline_reason,
    responded_by:           r.responded_by,
    responded_at:           r.responded_at,
    created_at:             r.created_at,
    updated_at:             r.updated_at,
    horse_name:             r.horse?.name ?? null,
    preferred_trainer_name: r.preferred_trainer?.full_name ?? null,
    requester_name:         r.requester?.full_name ?? null,
  };
}
