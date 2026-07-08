// Per-person conversation context for the Messages hub.
//
// When an owner/employee opens a direct thread, we resolve the OTHER
// participant to a client (if they are one) and count their pending
// requests — so the chat can double as the per-person hub: send an
// invoice, send a reminder, and see/act on their requests in one place.
//
// Read-only + RLS-scoped (user-context client). Returns null when the
// thread isn't a staff↔client conversation.

import { getSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ThreadClientContext = {
  clientId: string;
  clientName: string;
  clientProfileId: string;
  pendingLessonCount: number;
  pendingCareCount: number;
};

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

  // Count their still-pending requests (cheap head:true count queries).
  const [lessonRes, careRes] = await Promise.all([
    supabase
      .from("lesson_requests")
      .select("id", { count: "exact", head: true })
      .eq("requester_client_id", client.id)
      .eq("status", "pending"),
    supabase
      .from("care_requests")
      .select("id", { count: "exact", head: true })
      .eq("requester_client_id", client.id)
      .eq("status", "pending"),
  ]);

  return {
    clientId: client.id,
    clientName: (client as { full_name?: string | null }).full_name ?? "Client",
    clientProfileId: otherProfileId,
    pendingLessonCount: lessonRes.count ?? 0,
    pendingCareCount: careRes.count ?? 0,
  };
}
