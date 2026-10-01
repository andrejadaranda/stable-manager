// Google Calendar push webhook. Google POSTs here (headers only, no body)
// whenever a watched calendar changes. We verify the channel + token against
// our stored channel, then run an incremental import for that user. The
// hourly reconcile cron is the fallback for any notification Google drops.
//
// Respond fast with 200 — Google retries 5xx with backoff, and treats other
// codes as failure.

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { importCalendar } from "@/lib/google/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  const channelId = req.headers.get("x-goog-channel-id");
  const channelToken = req.headers.get("x-goog-channel-token");
  const state = req.headers.get("x-goog-resource-state");

  // The initial "sync" handshake carries no change — ack and ignore.
  if (!channelId || state === "sync") return new Response(null, { status: 200 });

  const admin = createSupabaseAdminClient();
  const { data: chan } = await admin
    .from("google_sync_channels")
    .select("user_id, channel_token, google_calendar_pk")
    .eq("channel_id", channelId)
    .maybeSingle();
  const row = chan as { user_id: string; channel_token: string | null; google_calendar_pk: string } | null;

  // Verify the token we set at watch time — rejects spoofed pings.
  if (!row || (row.channel_token && row.channel_token !== channelToken)) {
    return new Response(null, { status: 200 }); // ack anyway; nothing to do
  }

  try {
    await importCalendar(row.user_id, row.google_calendar_pk);
  } catch {
    // Swallow — the reconcile cron will catch up. Returning 200 avoids
    // Google hammering us with retries for a transient failure.
  }
  return new Response(null, { status: 200 });
}
