// Stables service — reads + edits the caller's own stable row.
// Owner-only. RLS already restricts to current_stable_id(); the role
// gate here adds a friendly error path for employees / clients.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";

export type StableRow = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  accepts_public_join: boolean;
};

export async function getOwnStable(): Promise<StableRow> {
  const session = await getSession();
  // any role inside the stable can read its own name
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("stables")
    .select("id, name, slug, created_at, accepts_public_join")
    .eq("id", session.stableId)
    .single();
  if (error) throw error;
  return data as StableRow;
}

/** Owner-only toggle for the public stable_join_requests insert gate
 *  (used by Settings → Stable). Defaults to true at provision time. */
export async function setStableAcceptsPublicJoin(enabled: boolean): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner");

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("stables")
    .update({ accepts_public_join: enabled })
    .eq("id", session.stableId);
  if (error) throw error;
}

export async function updateOwnStable(input: { name?: string }) {
  const session = await getSession();
  requireRole(session, "owner");

  const update: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (trimmed.length < 2)  throw new Error("STABLE_NAME_TOO_SHORT");
    if (trimmed.length > 80) throw new Error("STABLE_NAME_TOO_LONG");
    update.name = trimmed;
  }
  if (Object.keys(update).length === 0) return null;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("stables")
    .update(update)
    .eq("id", session.stableId)
    .select("id, name, slug, created_at, accepts_public_join")
    .single();
  if (error) throw error;
  return data as StableRow;
}
