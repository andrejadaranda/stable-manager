// Chat service.
//
// All operations run under the caller's JWT (createSupabaseServerClient
// uses the anon key + cookie session), so RLS is the security boundary.
// We never import createSupabaseAdminClient here — chat must NOT use
// the service role on any path.
//
// Permission model lives in the database:
//   * stable scoping  -> RLS via current_stable_id()
//   * direct DM pairs -> chat_can_dm() + start_direct_thread() RPC
//   * INSERTs to chat_threads / chat_participants -> RPCs only
// This file's role checks are belt-and-braces (clean error messages
// before round-tripping to Postgres) and not the source of truth.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, type Role } from "@/lib/auth/session";

// ---- Types -----------------------------------------------------

export type ChatThreadType = "stable_general" | "direct";

export type ChatThreadRow = {
  id: string;
  stable_id: string;
  type: ChatThreadType;
  title: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Other participants (for 'direct' threads). Empty for 'stable_general'. */
  participants: Array<{ id: string; full_name: string | null; role: Role }>;
  /** When the caller last read this thread; null = never marked. */
  last_read_at: string | null;
};

export type ChatMessageRow = {
  id: string;
  stable_id: string;
  thread_id: string;
  sender_profile_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  sender: { id: string; full_name: string | null; role: Role } | null;
};

export type ChatContact = {
  profile_id: string;
  full_name: string | null;
  role: Role;
};

// ---- Constants -------------------------------------------------

const MAX_BODY_LEN = 4000;

// ---- Helpers ---------------------------------------------------

/**
 * Mirror of database `chat_can_dm` for early validation in
 * getAvailableChatContacts. The DB function is the source of truth.
 */
function canDm(callerRole: Role, targetRole: Role): boolean {
  if (callerRole === "owner"    && targetRole === "employee") return true;
  if (callerRole === "employee" && targetRole === "owner")    return true;
  if (callerRole === "employee" && targetRole === "client")   return true;
  if (callerRole === "client"   && targetRole === "employee") return true;
  return false;
}

// ---- API -------------------------------------------------------

/**
 * List every chat thread visible to the caller, sorted with the
 * stable_general thread pinned to the top, then direct threads by
 * most recent activity.
 *
 * Visibility is enforced by RLS via chat_visible_thread_ids().
 * Returns participant info for direct threads so the UI can label
 * "DM with Eve" without an extra round-trip.
 */
export async function listChatThreads(): Promise<ChatThreadRow[]> {
  const session = await getSession();
  const supabase = createSupabaseServerClient();

  const { data: threads, error: threadsError } = await supabase
    .from("chat_threads")
    .select("id, stable_id, type, title, created_by, created_at, updated_at")
    .order("type", { ascending: true })          // 'direct' < 'stable_general' alphabetically
    .order("updated_at", { ascending: false });

  if (threadsError) throw threadsError;
  const threadRows = (threads ?? []) as Array<{
    id: string; stable_id: string; type: ChatThreadType; title: string | null;
    created_by: string | null; created_at: string; updated_at: string;
  }>;
  if (threadRows.length === 0) return [];

  const threadIds = threadRows.map((t) => t.id);

  // Pull every participant row for the visible threads. RLS guarantees
  // we can only see participants of threads we can see.
  const { data: participants, error: pErr } = await supabase
    .from("chat_participants")
    .select(`
      thread_id, profile_id, last_read_at,
      profile:profiles(id, full_name, role)
    `)
    .in("thread_id", threadIds);
  if (pErr) throw pErr;

  type PRow = {
    thread_id: string;
    profile_id: string;
    last_read_at: string | null;
    profile: { id: string; full_name: string | null; role: Role } | null;
  };
  const partRows = (participants ?? []) as unknown as PRow[];

  // Index by thread.
  const others = new Map<string, ChatThreadRow["participants"]>();
  const myReadAt = new Map<string, string | null>();
  for (const p of partRows) {
    if (!others.has(p.thread_id)) others.set(p.thread_id, []);
    if (p.profile_id === session.userId) {
      myReadAt.set(p.thread_id, p.last_read_at);
    } else if (p.profile) {
      others.get(p.thread_id)!.push({
        id: p.profile.id,
        full_name: p.profile.full_name,
        role: p.profile.role,
      });
    }
  }

  // Compose. Pin general first regardless of updated_at.
  const composed: ChatThreadRow[] = threadRows.map((t) => ({
    ...t,
    participants: others.get(t.id) ?? [],
    last_read_at: myReadAt.get(t.id) ?? null,
  }));
  composed.sort((a, b) => {
    if (a.type === "stable_general" && b.type !== "stable_general") return -1;
    if (b.type === "stable_general" && a.type !== "stable_general") return 1;
    return b.updated_at.localeCompare(a.updated_at);
  });
  return composed;
}

/**
 * Page of messages for a thread, newest first.
 * RLS enforces that the caller can see the thread; if they cannot,
 * Postgres returns zero rows. We deliberately do NOT translate the
 * empty-vs-forbidden distinction here — leaking "this thread exists
 * but you can't see it" is a small but real info-disclosure. UI
 * code should treat empty-and-no-error as "thread has no messages".
 *
 * Returns newest first; the message-panel UI is expected to reverse
 * for top-to-bottom chronological rendering.
 */
export async function getChatMessages(
  threadId: string,
  opts?: { limit?: number; before?: string },
): Promise<ChatMessageRow[]> {
  await getSession();                            // gate-only; RLS does the rest
  const supabase = createSupabaseServerClient();
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);

  let q = supabase
    .from("chat_messages")
    .select(`
      id, stable_id, thread_id, sender_profile_id, body, created_at, edited_at,
      sender:profiles(id, full_name, role)
    `)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (opts?.before) q = q.lt("created_at", opts.before);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as ChatMessageRow[];
}

/**
 * Insert a message into a thread. The RLS chat_messages_insert
 * policy enforces:
 *   * sender = caller
 *   * thread visible to caller
 *   * stable matches caller's stable
 * We pre-validate body length to return INVALID_BODY before the
 * round-trip, but the CHECK constraint is the actual guarantee.
 */
export async function sendChatMessage(threadId: string, body: string) {
  const session = await getSession();
  const trimmed = body?.trim() ?? "";
  if (trimmed.length === 0)             throw new Error("INVALID_BODY");
  if (trimmed.length > MAX_BODY_LEN)    throw new Error("INVALID_BODY");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      stable_id: session.stableId,
      thread_id: threadId,
      sender_profile_id: session.userId,
      body: trimmed,
    })
    .select(`
      id, stable_id, thread_id, sender_profile_id, body, created_at, edited_at,
      sender:profiles(id, full_name, role)
    `)
    .single();
  if (error) {
    // RLS rejection or check-constraint failure surfaces as a
    // PostgreSQL error; map common cases to clean tokens.
    if (error.message.includes("row-level security")) throw new Error("FORBIDDEN");
    if (error.message.includes("chat_messages_body_length")) throw new Error("INVALID_BODY");
    throw error;
  }
  return data as unknown as ChatMessageRow;
}

/**
 * Create (or return existing) a direct chat thread between the
 * caller and `targetProfileId`. Permission and dedup are enforced
 * inside the start_direct_thread RPC.
 *
 * Errors:
 *   FORBIDDEN — pair not allowed (client→owner, client→client, etc.)
 */
export async function startDirectChat(targetProfileId: string): Promise<string> {
  await getSession();
  if (!targetProfileId) throw new Error("INVALID_TARGET");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("start_direct_thread", {
    p_target_profile_id: targetProfileId,
  });
  if (error) {
    if (error.message.includes("CHAT_FORBIDDEN")) throw new Error("FORBIDDEN");
    if (error.message.includes("CHAT_UNAUTHENTICATED")) throw new Error("UNAUTHENTICATED");
    throw error;
  }
  if (!data) throw new Error("THREAD_NOT_CREATED");
  return data as string;
}

/**
 * Update last_read_at for the caller on a thread (general or direct).
 * Lazily upserts the participant row for general threads.
 */
export async function markThreadRead(threadId: string): Promise<void> {
  await getSession();
  if (!threadId) throw new Error("INVALID_THREAD");

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("mark_thread_read", { p_thread_id: threadId });
  if (error) {
    if (error.message.includes("CHAT_FORBIDDEN")) throw new Error("FORBIDDEN");
    throw error;
  }
}

/**
 * Returns the list of profiles in the caller's stable that the
 * caller is allowed to start a direct chat with. Used to populate
 * the "new DM" picker.
 *
 *   owner    -> employees
 *   employee -> owner + clients
 *   client   -> employees   (NEVER owner, NEVER other clients)
 */
export async function getAvailableChatContacts(): Promise<ChatContact[]> {
  const session = await getSession();
  const supabase = createSupabaseServerClient();

  // RLS: clients only see their OWN profile row. Staff see all in stable.
  // For a client picker, staff visibility is required — which is the
  // case for owner and employee. For clients, we restrict the candidate
  // role set to 'employee' and rely on the staff_read policy not
  // applying (clients won't see employees via that policy)...
  //
  // Wait: profiles_read_staff is owner/employee only. Clients can read
  // ONLY themselves via profiles_read_self. So a client calling
  // .from("profiles")... will get back only their own row.
  //
  // To let clients pick an employee/trainer to message, we use
  // a side-channel: profiles_read_via_own_lesson (07_calendar_policies)
  // exposes profiles of trainers a client has lessons with. That's the
  // sensible candidate set for a client. For employees and owner, we
  // can read all profiles in their stable.

  if (session.role === "client") {
    // The trainers a client has lessons with — already exposed by
    // profiles_read_via_own_lesson — are the only profiles a client
    // can see (besides themselves). Filter to role='employee' here.
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("role", "employee");
    if (error) throw error;
    return ((data ?? []) as Array<{ id: string; full_name: string | null; role: Role }>)
      .filter((p) => p.id !== session.userId && canDm(session.role, p.role))
      .map((p) => ({ profile_id: p.id, full_name: p.full_name, role: p.role }));
  }

  // Staff (owner/employee): see all profiles in stable. RLS scopes
  // by stable; we filter by allowed pair role.
  const allowedTargetRoles: Role[] =
    session.role === "owner" ? ["employee"] : ["owner", "client"];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .in("role", allowedTargetRoles);
  if (error) throw error;

  return ((data ?? []) as Array<{ id: string; full_name: string | null; role: Role }>)
    .filter((p) => p.id !== session.userId && canDm(session.role, p.role))
    .map((p) => ({ profile_id: p.id, full_name: p.full_name, role: p.role }));
}
