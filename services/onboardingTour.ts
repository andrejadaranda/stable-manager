// First-time tour state. Tracks profiles.onboarded_at — null until
// the user has either completed the tour or skipped it. Both states
// persist forever; the user can replay the tour from the Help menu
// (which writes a fresh timestamp, idempotent).
//
// Separate from /services/onboarding.ts (which tracks STABLE setup
// progress: first horse, first client, etc.). This service is per-USER.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

export async function isUserOnboarded(): Promise<boolean> {
  const session = await getSession();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .eq("id", session.userId)
    .single();
  if (error || !data) return false;
  return data.onboarded_at !== null;
}

export async function markUserOnboarded(): Promise<void> {
  const session = await getSession();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", session.userId);
  if (error) throw error;
}
