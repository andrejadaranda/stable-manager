// Resolves the current authenticated user + stable membership + role.
// Reads from `profiles` (renamed from `users`).
// For role='client', also resolves the linked clients.id so service
// functions can enforce "client may only see own data" cleanly.

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Role = "owner" | "employee" | "client";

export type SessionContext = {
  authUserId: string;       // auth.users.id (Supabase Auth)
  userId: string;           // profiles.id
  stableId: string;
  role: Role;
  clientId: string | null;  // clients.id, only set when role='client' and portal-linked
};

export async function getSession(): Promise<SessionContext> {
  const supabase = createSupabaseServerClient();

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("UNAUTHENTICATED");

  const { data: profile, error: e2 } = await supabase
    .from("profiles")
    .select("id, stable_id, role")
    .eq("auth_user_id", user.id)
    .single();
  if (e2 || !profile) throw new Error("USER_HAS_NO_STABLE");

  let clientId: string | null = null;
  if (profile.role === "client") {
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("profile_id", profile.id)
      .maybeSingle();
    clientId = client?.id ?? null;
  }

  return {
    authUserId: user.id,
    userId: profile.id,
    stableId: profile.stable_id,
    role: profile.role as Role,
    clientId,
  };
}

// Throws FORBIDDEN unless the caller's role is in `allowed`.
export function requireRole(s: SessionContext, ...allowed: Role[]): void {
  if (!allowed.includes(s.role)) throw new Error("FORBIDDEN");
}

// "Owner can act on any client in the stable; a client can act only on
// their own clients.id." Use for getClientBalance / getClientAccountSummary.
export function requireOwnerOrClientSelf(
  s: SessionContext,
  targetClientId: string,
): void {
  if (s.role === "owner") return;
  if (s.role === "client" && s.clientId === targetClientId) return;
  throw new Error("FORBIDDEN");
}
