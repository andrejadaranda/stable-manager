// Account service — caller's own profile.
// Used by /dashboard/settings/profile.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

export type OwnProfileRow = {
  id: string;
  full_name: string | null;
  role: "owner" | "employee" | "client";
  email: string | null;
  photo_url: string | null;
  phone: string | null;
};

export async function getOwnProfile(): Promise<OwnProfileRow> {
  const session = await getSession();
  const supabase = createSupabaseServerClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, photo_url, phone")
    .eq("id", session.userId)
    .single();
  if (error) throw error;

  // Pull email from auth context. supabase.auth.getUser() is already cached
  // for this request via the SSR client.
  const { data: { user } } = await supabase.auth.getUser();
  return {
    ...(profile as { id: string; full_name: string | null; role: OwnProfileRow["role"]; photo_url: string | null; phone: string | null }),
    email: user?.email ?? null,
  };
}

export type OwnStableRow = {
  id:    string;
  name:  string;
  slug:  string | null;
};

/** Returns the stable the caller belongs to. RLS narrows to one row. */
export async function getOwnStable(): Promise<OwnStableRow | null> {
  const session = await getSession();
  void session;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("stables")
    .select("id, name, slug")
    .single();
  if (error) return null;
  return data as OwnStableRow;
}

export async function updateOwnProfile(input: {
  fullName?: string;
  photoUrl?: string | null;
  phone?: string | null;
}) {
  const session = await getSession();
  const update: Record<string, unknown> = {};

  if (input.fullName !== undefined) {
    const trimmed = input.fullName.trim();
    if (trimmed.length < 1)  throw new Error("FULL_NAME_REQUIRED");
    if (trimmed.length > 80) throw new Error("FULL_NAME_TOO_LONG");
    update.full_name = trimmed;
  }
  if (input.photoUrl !== undefined) {
    const v = input.photoUrl?.trim();
    update.photo_url = !v ? null : v;
  }
  if (input.phone !== undefined) {
    const v = input.phone?.trim();
    update.phone = !v ? null : v;
  }

  if (Object.keys(update).length === 0) return;

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", session.userId);
  if (error) throw error;
}
