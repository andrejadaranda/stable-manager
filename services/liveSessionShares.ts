// Live-session beacon shares (Sprint 4 W3).
// Mint / list / revoke from the rider/owner/trainer side.
// Public read side runs through SECURITY DEFINER RPCs called from
// the /live/[token] anonymous page.

import { randomBytes } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

export type { LiveSessionShare, BeaconPoint, BeaconBootstrap } from "./liveSessionShares.pure";
import type { LiveSessionShare } from "./liveSessionShares.pure";

function mintToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Mint OR rotate the share token for a session. One row per session
 *  (UNIQUE constraint), so subsequent calls upsert + refresh expiry. */
export async function ensureLiveShare(sessionId: string): Promise<LiveSessionShare> {
  const ctx = await getSession();
  const supabase = createSupabaseServerClient();

  // Same-stable + role check happens through RLS on the underlying
  // sessions table embed. The explicit confirmation gives a clearer
  // error than RLS-silently-empty.
  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select("id, stable_id, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (sErr || !session) throw new Error("SESSION_NOT_FOUND");
  if (session.stable_id !== ctx.stableId) throw new Error("FORBIDDEN");

  // Existing share for this session? Reuse + bump expiry.
  const { data: existing } = await supabase
    .from("live_session_shares")
    .select("id, session_id, token, expires_at, revoked_at, created_at, view_count, last_viewed_at")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (existing && !existing.revoked_at) {
    const expiresAt = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from("live_session_shares")
      .update({ expires_at: expiresAt })
      .eq("id", existing.id)
      .select("id, session_id, token, expires_at, revoked_at, created_at, view_count, last_viewed_at")
      .single();
    if (error) throw error;
    return data as LiveSessionShare;
  }

  // Otherwise insert a fresh one (or replace a revoked one — drop + re-insert).
  if (existing) {
    await supabase.from("live_session_shares").delete().eq("id", existing.id);
  }

  const expiresAt = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from("live_session_shares")
    .insert({
      session_id: sessionId,
      stable_id:  session.stable_id,
      token:      mintToken(),
      expires_at: expiresAt,
    })
    .select("id, session_id, token, expires_at, revoked_at, created_at, view_count, last_viewed_at")
    .single();
  if (error) throw error;
  return data as LiveSessionShare;
}

export async function getLiveShareForSession(sessionId: string): Promise<LiveSessionShare | null> {
  await getSession();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("live_session_shares")
    .select("id, session_id, token, expires_at, revoked_at, created_at, view_count, last_viewed_at")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as LiveSessionShare | null;
}

export async function revokeLiveShare(sessionId: string): Promise<void> {
  await getSession();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("live_session_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("session_id", sessionId);
  if (error) throw error;
}
