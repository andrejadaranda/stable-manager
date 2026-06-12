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
import { startDirectChat, sendChatMessage } from "./chat";
import type {
  LessonRequestStatus,
  LessonRequestRow,
  LessonRequestWithContext,
} from "./lessonRequests.types";

// Re-export types + presentation maps from the client-safe sibling file
// so existing server-side imports keep working without churn.
export type {
  LessonRequestStatus,
  LessonRequestRow,
  LessonRequestWithContext,
} from "./lessonRequests.types";
export { LESSON_STATUS_LABEL } from "./lessonRequests.types";

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
  return (((data ?? []) as unknown) as Array<LessonRequestRow & {
    horse:             { name: string } | { name: string }[] | null;
    preferred_trainer: { full_name: string } | { full_name: string }[] | null;
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

  return (((data ?? []) as unknown) as Array<LessonRequestRow & {
    horse:             { name: string } | { name: string }[] | null;
    preferred_trainer: { full_name: string } | { full_name: string }[] | null;
    requester:         { full_name: string } | { full_name: string }[] | null;
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
  await notifyClientOfRequestDecision(input.requestId, "accepted");
  return data as string;  // new lesson id
}

/**
 * Close the loop: DM the requesting client when their request is decided,
 * so they learn the outcome without hunting through the app. Best-effort —
 * never let a chat hiccup fail the accept/decline. Skipped silently when the
 * client has no app account (no profile to message).
 */
async function notifyClientOfRequestDecision(
  requestId: string,
  kind: "accepted" | "declined" | "countered",
): Promise<void> {
  try {
    const supabase = createSupabaseServerClient();
    const { data: req } = await supabase
      .from("lesson_requests")
      .select("requester_client_id, requested_start, proposed_start, requested_duration_min, decline_reason, horse_id")
      .eq("id", requestId)
      .maybeSingle();
    if (!req) return;

    const { data: client } = await supabase
      .from("clients")
      .select("profile_id")
      .eq("id", (req as { requester_client_id: string }).requester_client_id)
      .maybeSingle();
    const profileId = (client as { profile_id: string | null } | null)?.profile_id;
    if (!profileId) return; // client isn't on the app — nothing to post

    const r = req as {
      requested_start: string; proposed_start: string | null; requested_duration_min: number;
      decline_reason: string | null; horse_id: string | null;
    };
    let horseName: string | null = null;
    if (r.horse_id) {
      const { data: h } = await supabase.from("horses").select("name").eq("id", r.horse_id).maybeSingle();
      horseName = (h as { name: string } | null)?.name ?? null;
    }

    const fmt = (iso: string) => new Date(iso).toLocaleString("en-GB", {
      weekday: "short", day: "2-digit", month: "short",
      hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vilnius",
    });
    const when = fmt(r.requested_start);
    const horsePart = horseName ? ` · ${horseName}` : "";
    let body: string;
    if (kind === "accepted") {
      body = `Lesson request confirmed — ${when}, ${r.requested_duration_min} min${horsePart}. It's on your calendar now.`;
    } else if (kind === "countered") {
      const proposed = r.proposed_start ? fmt(r.proposed_start) : when;
      body = `New time proposed for your lesson request: ${proposed}, ${r.requested_duration_min} min${horsePart}. Open My lessons to accept or decline.`;
    } else {
      body = `Lesson request declined — ${when}, ${r.requested_duration_min} min${horsePart}.` +
        (r.decline_reason ? ` Reason: ${r.decline_reason}` : "") +
        ` You can request another time anytime.`;
    }

    const threadId = await startDirectChat(profileId);
    await sendChatMessage(threadId, body);
  } catch (err) {
    console.warn("[lessonRequests] could not post decision to chat:", err);
  }
}

/** Stable proposes a different time instead of declining. Sets status
 *  'countered' + proposed_start and DMs the client to accept/decline. */
export async function counterLessonRequest(requestId: string, proposedStartISO: string): Promise<void> {
  const session = await getSession();
  if (session.role !== "owner" && session.role !== "employee") throw new Error("FORBIDDEN");
  if (!proposedStartISO) throw new Error("MISSING_TIME");

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("lesson_requests")
    .update({ status: "countered", proposed_start: proposedStartISO })
    .eq("id", requestId);
  if (error) throw error;
  await notifyClientOfRequestDecision(requestId, "countered");
}

/** Client responds to a counter-offer. Accept → request returns to pending
 *  at the proposed time (owner finalises with horse/trainer). Decline →
 *  request is declined. Owner sees the outcome in their requests inbox. */
export async function respondToCounterOffer(requestId: string, accept: boolean): Promise<void> {
  const session = await getSession();
  if (session.role !== "client") throw new Error("FORBIDDEN");

  const supabase = createSupabaseServerClient();
  const { data: req, error: rErr } = await supabase
    .from("lesson_requests")
    .select("proposed_start, status")
    .eq("id", requestId)
    .maybeSingle();
  if (rErr) throw rErr;
  if (!req) throw new Error("REQUEST_NOT_FOUND");
  const r = req as { proposed_start: string | null; status: string };
  if (r.status !== "countered") throw new Error("NOT_COUNTERED");

  if (accept && r.proposed_start) {
    const { error } = await supabase
      .from("lesson_requests")
      .update({ status: "pending", requested_start: r.proposed_start, proposed_start: null })
      .eq("id", requestId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("lesson_requests")
      .update({ status: "declined", proposed_start: null })
      .eq("id", requestId);
    if (error) throw error;
  }
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
  await notifyClientOfRequestDecision(requestId, "declined");
}

// =============================================================
// Helpers
// =============================================================

// LESSON_STATUS_LABEL re-exported from lessonRequests.types.ts at the top
// so server- and client-side imports stay aligned.

type Joined<T> = T | T[] | null | undefined;
function pick<T>(v: Joined<T>): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function flattenContext(r: LessonRequestRow & {
  horse?:             Joined<{ name: string }>;
  preferred_trainer?: Joined<{ full_name: string }>;
  requester?:         Joined<{ full_name: string }>;
}): LessonRequestWithContext {
  const horse = pick(r.horse);
  const trainer = pick(r.preferred_trainer);
  const requester = pick(r.requester);
  return {
    id:                     r.id,
    stable_id:              r.stable_id,
    requester_client_id:    r.requester_client_id,
    horse_id:               r.horse_id,
    preferred_trainer_id:   r.preferred_trainer_id,
    requested_start:        r.requested_start,
    proposed_start:         r.proposed_start,
    requested_duration_min: r.requested_duration_min,
    notes:                  r.notes,
    status:                 r.status,
    accepted_lesson_id:     r.accepted_lesson_id,
    decline_reason:         r.decline_reason,
    responded_by:           r.responded_by,
    responded_at:           r.responded_at,
    created_at:             r.created_at,
    updated_at:             r.updated_at,
    horse_name:             horse?.name ?? null,
    preferred_trainer_name: trainer?.full_name ?? null,
    requester_name:         requester?.full_name ?? null,
  };
}
