// =============================================================
// Public stable-join requests.
//
// Two anon-safe RPCs power the public landing page:
//   * public_stables_for_join() — list every stable that accepts joins
//   * public_stable_by_slug(slug) — pre-fill the join form by URL
//
// Owner side uses RLS-scoped reads + the approve_join_request RPC,
// which atomically creates a clients row and links it back to the
// request. The server action then triggers sendClientInvite() so the
// applicant receives the existing invitation email and lands in the
// already-shipped /invite/[token] accept flow.
// =============================================================

import { createSupabaseAnonClient } from "@/lib/supabase/anon";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

export type JoinRequestRole = "rider" | "horse_owner";
export type JoinRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export type PublicStable = {
  id:   string;
  name: string;
  slug: string;
};

export type PublicStableLookup = PublicStable & {
  accepts_public_join: boolean;
};

export type JoinRequestRow = {
  id:                string;
  stable_id:         string;
  requested_role:    JoinRequestRole;
  full_name:         string;
  email:             string;
  phone:             string | null;
  message:           string | null;
  status:            JoinRequestStatus;
  decline_reason:    string | null;
  responded_by:      string | null;
  responded_at:      string | null;
  created_client_id: string | null;
  created_at:        string;
  updated_at:        string;
};

// =============================================================
// PUBLIC reads — used by the unauthenticated signup page.
// =============================================================

export async function listPublicStablesForJoin(): Promise<PublicStable[]> {
  const supabase = createSupabaseAnonClient();
  const { data, error } = await supabase.rpc("public_stables_for_join");
  if (error) throw error;
  return (data ?? []) as PublicStable[];
}

export async function getPublicStableBySlug(slug: string): Promise<PublicStableLookup | null> {
  const supabase = createSupabaseAnonClient();
  const { data, error } = await supabase.rpc("public_stable_by_slug", { p_slug: slug });
  if (error) throw error;
  const row = (data ?? [])[0] as PublicStableLookup | undefined;
  return row ?? null;
}

// =============================================================
// PUBLIC write — anon insert (RLS gate enforces stable accepts joins).
// =============================================================

export type SubmitJoinRequestInput = {
  stableId:      string;
  requestedRole: JoinRequestRole;
  fullName:      string;
  email:         string;
  phone?:        string | null;
  message?:      string | null;
};

export async function submitJoinRequest(input: SubmitJoinRequestInput): Promise<void> {
  // Routes through submit_public_join_request (SECURITY DEFINER RPC) so the
  // server-side rate limit (max 3 per (stable, email) per 24h) can run on
  // a table anon can't SELECT. Direct insert would still work but anon has
  // no way to count its own submissions, so spam protection has to live
  // server-side.
  const supabase = createSupabaseAnonClient();
  const { error } = await supabase.rpc("submit_public_join_request", {
    p_stable_id:      input.stableId,
    p_requested_role: input.requestedRole,
    p_full_name:      input.fullName.trim(),
    p_email:          input.email.trim().toLowerCase(),
    p_phone:          input.phone?.trim() || null,
    p_message:        input.message?.trim() || null,
  });
  if (error) {
    // Translate the well-known Postgres exception strings into UX copy.
    if (error.message.includes("RATE_LIMITED")) {
      throw new Error(
        "You've already applied to this stable today. Please wait for them to respond before re-applying.",
      );
    }
    if (error.message.includes("STABLE_CLOSED_TO_APPLICATIONS")) {
      throw new Error("This stable is not accepting applications right now.");
    }
    if (error.message.includes("INVALID_EMAIL")) {
      throw new Error("Enter a valid email address.");
    }
    if (error.message.includes("FULL_NAME_REQUIRED")) {
      throw new Error("Please enter your full name.");
    }
    if (error.message.includes("INVALID_ROLE")) {
      throw new Error("Pick rider or horse owner.");
    }
    throw error;
  }
}

// =============================================================
// OWNER reads / writes
// =============================================================

export async function listJoinRequestsForOwner(opts?: {
  status?: JoinRequestStatus | "open";
  limit?:  number;
}): Promise<JoinRequestRow[]> {
  const session = await getSession();
  if (session.role !== "owner" && session.role !== "employee") throw new Error("FORBIDDEN");

  const supabase = createSupabaseServerClient();
  let q = supabase
    .from("stable_join_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 100);

  if (opts?.status === "open") {
    q = q.eq("status", "pending");
  } else if (opts?.status) {
    q = q.eq("status", opts.status);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as JoinRequestRow[];
}

export async function countPendingJoinRequests(): Promise<number> {
  const session = await getSession();
  if (session.role !== "owner" && session.role !== "employee") return 0;

  const supabase = createSupabaseServerClient();
  const { count, error } = await supabase
    .from("stable_join_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  if (error) throw error;
  return count ?? 0;
}

export async function approveJoinRequest(requestId: string): Promise<string> {
  const session = await getSession();
  if (session.role !== "owner" && session.role !== "employee") throw new Error("FORBIDDEN");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("approve_join_request", {
    p_request_id: requestId,
  });
  if (error) throw error;
  return data as string;  // new client id
}

export async function rejectJoinRequest(requestId: string, reason?: string | null): Promise<void> {
  const session = await getSession();
  if (session.role !== "owner" && session.role !== "employee") throw new Error("FORBIDDEN");

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("stable_join_requests")
    .update({
      status:         "rejected",
      decline_reason: reason?.trim() || null,
      responded_at:   new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) throw error;
}
