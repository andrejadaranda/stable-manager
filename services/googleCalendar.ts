// Google Calendar connection lifecycle + token management (server-only).
//
// Token columns (access_token/refresh_token) are read and written ONLY via
// the service-role admin client here, and migration 119 revokes column
// SELECT on them from the authenticated role — so even the owner's browser
// session cannot read a refresh token. UI reads go through getConnectionPublic
// (non-secret columns via the RLS client).

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { refreshAccessToken, revokeToken, type TokenResponse } from "@/lib/google/oauth";
import { listCalendarList } from "@/lib/google/client";

export type GoogleConnectionPublic = {
  id: string;
  google_account_email: string | null;
  status: "connected" | "needs_reauth" | "revoked" | "error";
  sync_enabled: boolean;
  write_calendar_id: string | null;
  last_error: string | null;
  push_personal: boolean;
  push_lessons: boolean;
};

export type GoogleCalendarRow = {
  id: string;
  google_calendar_id: string;
  summary: string | null;
  background_color: string | null;
  access_role: string | null;
  primary_cal: boolean;
  read_enabled: boolean;
  is_write_target: boolean;
};

// ---------- internal (admin, token-bearing) ----------

type ConnRow = {
  id: string;
  user_id: string;
  stable_id: string;
  google_account_email: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  status: string;
  write_calendar_id: string | null;
};

const CONN_COLS = "id, user_id, stable_id, google_account_email, access_token, refresh_token, token_expires_at, status, write_calendar_id";

/** Load the full connection row (with tokens) for a user — admin only. */
export async function getConnectionAdmin(userId: string): Promise<ConnRow | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("google_calendar_connections")
    .select(CONN_COLS)
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();
  return (data as ConnRow) ?? null;
}

/** Return a valid access token for this connection, refreshing + persisting
 *  if it is missing or within 60s of expiry. On invalid_grant, flags the
 *  connection needs_reauth and rethrows GOOGLE_REAUTH_REQUIRED. */
export async function getValidAccessToken(conn: ConnRow): Promise<string> {
  const now = Date.now();
  const exp = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (conn.access_token && exp - now > 60_000) return conn.access_token;
  if (!conn.refresh_token) throw new Error("GOOGLE_REAUTH_REQUIRED");

  const admin = createSupabaseAdminClient();
  try {
    const t = await refreshAccessToken(conn.refresh_token);
    const expiresAt = new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString();
    await admin
      .from("google_calendar_connections")
      .update({ access_token: t.access_token, token_expires_at: expiresAt, status: "connected", last_error: null, updated_at: new Date().toISOString() })
      .eq("id", conn.id);
    conn.access_token = t.access_token;
    conn.token_expires_at = expiresAt;
    return t.access_token;
  } catch (err) {
    if ((err as Error).message === "GOOGLE_REAUTH_REQUIRED") {
      await admin
        .from("google_calendar_connections")
        .update({ status: "needs_reauth", last_error: "Google access needs to be reconnected.", updated_at: new Date().toISOString() })
        .eq("id", conn.id);
    }
    throw err;
  }
}

/** Upsert a connection from a fresh token exchange. Keeps the existing
 *  refresh token if Google didn't return a new one. */
export async function saveConnectionFromTokens(
  userId: string,
  stableId: string,
  tokens: TokenResponse,
  email: string | null,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();
  const existing = await getConnectionAdmin(userId);
  const refresh = tokens.refresh_token ?? existing?.refresh_token ?? null;
  const payload = {
    user_id: userId,
    stable_id: stableId,
    provider: "google",
    google_account_email: email,
    access_token: tokens.access_token,
    refresh_token: refresh,
    token_expires_at: expiresAt,
    scopes: tokens.scope ?? null,
    status: "connected",
    last_error: null,
    updated_at: new Date().toISOString(),
  };
  if (existing) {
    await admin.from("google_calendar_connections").update(payload).eq("id", existing.id);
  } else {
    await admin.from("google_calendar_connections").insert({ ...payload, connected_at: new Date().toISOString() });
  }
}

/** Pull the account's calendar list and upsert google_calendars rows.
 *  New calendars default to not-read; the user opts them in. */
export async function syncCalendarList(userId: string): Promise<void> {
  const conn = await getConnectionAdmin(userId);
  if (!conn) throw new Error("NO_GOOGLE_CONNECTION");
  const token = await getValidAccessToken(conn);
  const cals = await listCalendarList(token);
  const admin = createSupabaseAdminClient();
  for (const c of cals) {
    if (c.deleted) continue;
    await admin
      .from("google_calendars")
      .upsert(
        {
          connection_id: conn.id,
          user_id: userId,
          google_calendar_id: c.id,
          summary: c.summaryOverride || c.summary || c.id,
          background_color: c.backgroundColor ?? null,
          access_role: c.accessRole ?? null,
          primary_cal: c.primary ?? false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "connection_id,google_calendar_id", ignoreDuplicates: false },
      );
  }
}

// ---------- UI-facing (RLS client, no token columns) ----------

export async function getConnectionPublic(): Promise<GoogleConnectionPublic | null> {
  await getSession();
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("google_calendar_connections")
    .select("id, google_account_email, status, sync_enabled, write_calendar_id, last_error, push_personal, push_lessons")
    .eq("provider", "google")
    .maybeSingle();
  return (data as GoogleConnectionPublic) ?? null;
}

export async function isGoogleConnected(): Promise<boolean> {
  try {
    const c = await getConnectionPublic();
    return !!c && c.status === "connected";
  } catch {
    return false;
  }
}

export async function listGoogleCalendars(): Promise<GoogleCalendarRow[]> {
  await getSession();
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("google_calendars")
    .select("id, google_calendar_id, summary, background_color, access_role, primary_cal, read_enabled, is_write_target")
    .order("primary_cal", { ascending: false })
    .order("summary", { ascending: true });
  return (data ?? []) as GoogleCalendarRow[];
}

export async function setCalendarRead(googleCalendarPk: string, read: boolean): Promise<void> {
  await getSession();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("google_calendars").update({ read_enabled: read, updated_at: new Date().toISOString() }).eq("id", googleCalendarPk);
  if (error) throw error;
}

export async function setWriteTarget(googleCalendarPk: string): Promise<void> {
  const session = await getSession();
  const supabase = createSupabaseServerClient();
  // Clear previous write target, set the new one, mirror onto the connection.
  await supabase.from("google_calendars").update({ is_write_target: false }).eq("user_id", session.userId);
  const { data: row } = await supabase.from("google_calendars").update({ is_write_target: true, updated_at: new Date().toISOString() }).eq("id", googleCalendarPk).select("google_calendar_id").single();
  const calId = (row as { google_calendar_id: string } | null)?.google_calendar_id;
  if (calId) await supabase.from("google_calendar_connections").update({ write_calendar_id: calId, updated_at: new Date().toISOString() }).eq("provider", "google");
}

export async function setSyncEnabled(enabled: boolean): Promise<void> {
  await getSession();
  const supabase = createSupabaseServerClient();
  await supabase.from("google_calendar_connections").update({ sync_enabled: enabled, updated_at: new Date().toISOString() }).eq("provider", "google");
}

/** Disconnect: stop watch channels, revoke at Google, delete imported events
 *  (they're a mirror), and remove the connection + its calendars/mappings.
 *  The user's real Google events are never touched. */
export async function disconnectGoogle(userId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  // Revoke the grant at Google first (best-effort) so Longrein's access is
  // fully withdrawn — this does NOT delete the user's Google events.
  const conn = await getConnectionAdmin(userId);
  if (conn?.refresh_token) await revokeToken(conn.refresh_token);
  else if (conn?.access_token) await revokeToken(conn.access_token);
  // Delete imported events (mirror only) — keep the user's Longrein events.
  await admin.from("calendar_personal_events").delete().eq("user_id", userId).eq("source", "google");
  // Mappings + calendars + channels cascade from the connection delete, but
  // channels need an explicit Google stop first — handled by the caller/cron.
  await admin.from("google_calendar_connections").delete().eq("user_id", userId).eq("provider", "google");
}
