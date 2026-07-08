// Per-person conversation context for the Messages hub.
//
// When an owner/employee opens a direct thread, we resolve the OTHER
// participant to a client (if they are one) and load their pending
// requests — so the chat doubles as the per-person hub: send an invoice,
// send a reminder, and act on their requests in one place.
//
// Read-only + RLS-scoped (user-context client). Returns null when the
// thread isn't a staff↔client conversation.

import { getSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PendingLessonReq = {
  id: string;
  whenLabel: string | null;
  horse: string | null;
  note: string | null;
};

export type PendingCareReq = {
  id: string;
  kind: string;
  urgency: string;
  horse: string | null;
  note: string | null;
};

export type OpenReminder = { id: string; body: string };

export type ThreadClientContext = {
  clientId: string;
  clientName: string;
  clientProfileId: string;
  lessonRequests: PendingLessonReq[];
  careRequests: PendingCareReq[];
  reminders: OpenReminder[];
};

/** PostgREST returns an embedded relation as object | array | null. */
function pickName(rel: unknown): string | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return (rel[0] as { name?: string })?.name ?? null;
  return (rel as { name?: string }).name ?? null;
}

function fmtWhen(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
    timeZone: "Europe/Vilnius",
  }).format(new Date(iso));
}

export async function getThreadClientContext(
  otherProfileId: string | null,
): Promise<ThreadClientContext | null> {
  if (!otherProfileId) return null;

  const session = await getSession();
  if (session.role !== "owner" && session.role !== "employee") return null;

  const supabase = createSupabaseServerClient();

  // Is the other participant a client of this stable?
  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name")
    .eq("profile_id", otherProfileId)
    .maybeSingle();
  if (!client) return null;

  const [lessonRes, careRes, reminderRes] = await Promise.all([
    supabase
      .from("lesson_requests")
      .select("id, requested_start, proposed_start, notes, horse:horses(name)")
      .eq("requester_client_id", client.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase
      .from("care_requests")
      .select("id, type, urgency, notes, horse:horses(name)")
      .eq("requester_client_id", client.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    // Open reminders the staff created for this person (RLS: creator sees them).
    supabase
      .from("reminders")
      .select("id, body")
      .eq("assigned_to", otherProfileId)
      .is("completed_at", null)
      .order("created_at", { ascending: true }),
  ]);

  const lessonRequests: PendingLessonReq[] = ((lessonRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    whenLabel: fmtWhen((r.proposed_start as string | null) ?? (r.requested_start as string | null)),
    horse: pickName(r.horse),
    note: (r.notes as string | null) ?? null,
  }));

  const careRequests: PendingCareReq[] = ((careRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    kind: String(r.type ?? "care"),
    urgency: String(r.urgency ?? "normal"),
    horse: pickName(r.horse),
    note: (r.notes as string | null) ?? null,
  }));

  const reminders: OpenReminder[] = ((reminderRes.data ?? []) as Array<{ id: string; body: string }>)
    .map((r) => ({ id: String(r.id), body: r.body }));

  return {
    clientId: client.id,
    clientName: (client as { full_name?: string | null }).full_name ?? "Client",
    clientProfileId: otherProfileId,
    lessonRequests,
    careRequests,
    reminders,
  };
}
