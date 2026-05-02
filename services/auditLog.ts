// Audit log service — owner-only chronological feed of every write
// on the security-relevant tables. The DB-level trigger does the
// capture; this layer just reads + joins the actor name.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";

export type AuditLogRow = {
  id: string;
  stable_id: string;
  actor_profile_id: string | null;
  actor_role: "owner" | "employee" | "client" | null;
  table_name: string;
  row_id: string;
  action: "insert" | "update" | "delete";
  changes_summary: string | null;
  created_at: string;
  /** Joined for display. */
  actor: { id: string; full_name: string | null } | null;
};

export async function listAuditLog(opts?: {
  limit?:     number;
  tableName?: string;
  action?:    "insert" | "update" | "delete";
}): Promise<AuditLogRow[]> {
  const session = await getSession();
  requireRole(session, "owner");
  void session;

  const supabase = createSupabaseServerClient();
  let q = supabase
    .from("audit_log")
    .select(
      `
      id, stable_id, actor_profile_id, actor_role, table_name, row_id, action, changes_summary, created_at,
      actor:profiles!audit_log_actor_profile_id_fkey(id, full_name)
      `,
    )
    .order("created_at", { ascending: false });

  if (opts?.tableName) q = q.eq("table_name", opts.tableName);
  if (opts?.action)    q = q.eq("action", opts.action);
  q = q.limit(opts?.limit ?? 100);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as AuditLogRow[];
}
