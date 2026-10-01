// Google push (watch) channel lifecycle. Channels expire and do not
// auto-renew, so we (re)create them whenever one is missing or within a day
// of expiry. The webhook only pings "something changed" — the reconcile pass
// then does the actual incremental import, and also serves as the fallback
// when a push notification is dropped (Google warns delivery isn't 100%).

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getConnectionAdmin, getValidAccessToken } from "@/services/googleCalendar";
import { watchEvents, stopChannel } from "@/lib/google/client";

function webhookUrl(): string {
  if (process.env.GOOGLE_WEBHOOK_URL) return process.env.GOOGLE_WEBHOOK_URL;
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://app.longrein.eu";
  return `${base.replace(/\/$/, "")}/api/google/webhook`;
}

const RENEW_BEFORE_MS = 24 * 3600 * 1000; // renew when < 1 day left

/** Ensure a live watch channel exists for each read-enabled calendar.
 *  Creates missing channels and replaces ones near expiry. Best-effort. */
export async function ensureWatchChannels(userId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const conn = await getConnectionAdmin(userId);
  if (!conn || conn.status !== "connected") return;

  const { data: cals } = await admin
    .from("google_calendars")
    .select("id, google_calendar_id, read_enabled")
    .eq("user_id", userId)
    .eq("read_enabled", true);
  const calendars = (cals ?? []) as { id: string; google_calendar_id: string }[];
  if (calendars.length === 0) return;

  let token: string;
  try {
    token = await getValidAccessToken(conn);
  } catch {
    return;
  }
  const address = webhookUrl();
  // HTTPS only — Google refuses http/localhost webhooks.
  if (!address.startsWith("https://")) return;

  for (const cal of calendars) {
    const { data: existing } = await admin
      .from("google_sync_channels")
      .select("id, channel_id, resource_id, expiration")
      .eq("google_calendar_pk", cal.id)
      .order("expiration", { ascending: false })
      .limit(1)
      .maybeSingle();
    const row = existing as { id: string; channel_id: string; resource_id: string | null; expiration: string | null } | null;
    const healthy = row?.expiration && new Date(row.expiration).getTime() - Date.now() > RENEW_BEFORE_MS;
    if (healthy) continue;

    const channelId = crypto.randomUUID();
    const channelToken = crypto.randomUUID();
    try {
      const res = await watchEvents(token, cal.google_calendar_id, channelId, address, channelToken);
      await admin.from("google_sync_channels").insert({
        user_id: userId,
        google_calendar_pk: cal.id,
        channel_id: channelId,
        resource_id: res.resourceId,
        channel_token: channelToken,
        expiration: res.expiration ? new Date(Number(res.expiration)).toISOString() : null,
      });
      // Stop the old channel we're replacing (best-effort).
      if (row?.channel_id && row.resource_id) {
        await stopChannel(token, row.channel_id, row.resource_id).catch(() => {});
        await admin.from("google_sync_channels").delete().eq("id", row.id);
      }
    } catch {
      /* channel creation needs a public HTTPS webhook with a valid cert;
         if it fails we still have the reconcile poll as a fallback. */
    }
  }
}

/** Stop + delete all watch channels for a user (used on disconnect). */
export async function stopAllChannels(userId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const conn = await getConnectionAdmin(userId);
  const { data: chans } = await admin
    .from("google_sync_channels")
    .select("id, channel_id, resource_id")
    .eq("user_id", userId);
  const rows = (chans ?? []) as { id: string; channel_id: string; resource_id: string | null }[];
  if (rows.length === 0) return;
  let token: string | null = null;
  if (conn) { try { token = await getValidAccessToken(conn); } catch { token = null; } }
  for (const r of rows) {
    if (token && r.resource_id) await stopChannel(token, r.channel_id, r.resource_id).catch(() => {});
    await admin.from("google_sync_channels").delete().eq("id", r.id);
  }
}
