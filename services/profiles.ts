// Profiles service — minimal. Used by the lesson form to populate
// the trainer dropdown, and by the Team page for member management.

import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";

export type Member = {
  id: string;
  full_name: string | null;
  role: "owner" | "employee" | "client";
  auth_user_id: string;
  email: string | null;
  created_at: string;
};

// Profiles in the caller's stable that can be assigned as a lesson trainer
// (owner or employee). Staff-only.
export async function listTrainers() {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .in("role", ["owner", "employee"])
    .order("full_name");
  if (error) throw error;
  return data ?? [];
}

// Owner-only: list every member of this stable with their auth email.
// Uses the admin client (server-side only) to look up emails — RLS on
// profiles already scopes to the caller's stable.
export async function listMembers(): Promise<Member[]> {
  const session = await getSession();
  requireRole(session, "owner");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, auth_user_id, created_at")
    .order("role")
    .order("full_name");
  if (error) throw error;
  const profiles = (data ?? []) as Omit<Member, "email">[];

  // Look up emails. listUsers paginates; for MVP we accept the default
  // page size (50). For larger orgs, switch to per-id getUserById calls.
  const admin = createSupabaseAdminClient();
  const { data: usersResp } = await admin.auth.admin.listUsers({ perPage: 200 });
  const emailById = new Map<string, string>();
  for (const u of usersResp?.users ?? []) {
    if (u.email) emailById.set(u.id, u.email);
  }

  return profiles.map((p) => ({
    ...p,
    email: emailById.get(p.auth_user_id) ?? null,
  }));
}
