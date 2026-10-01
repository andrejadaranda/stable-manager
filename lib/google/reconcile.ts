// Periodic Google reconciliation — the safety net that runs on the hourly
// cron. For every connected user it:
//   1. renews/creates watch channels nearing expiry,
//   2. runs an incremental import of all read-enabled calendars (also the
//      fallback for any dropped push notification),
//   3. retries pushing personal events that are pending/errored.
// All best-effort and per-user isolated so one bad account can't stall others.

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { importAllForUser, pushPersonalEvent, pushLessonsForUser } from "@/lib/google/sync";
import { ensureWatchChannels } from "@/lib/google/channels";

export type GoogleReconcileResult = { users: number; imported: number; pushed: number; errors: number };

export async function runGoogleReconcile(): Promise<GoogleReconcileResult> {
  const admin = createSupabaseAdminClient();
  const tally: GoogleReconcileResult = { users: 0, imported: 0, pushed: 0, errors: 0 };

  const { data: conns } = await admin
    .from("google_calendar_connections")
    .select("user_id, status, sync_enabled")
    .eq("provider", "google")
    .eq("status", "connected");

  for (const c of (conns ?? []) as { user_id: string; status: string; sync_enabled: boolean }[]) {
    tally.users += 1;
    try {
      await ensureWatchChannels(c.user_id);
      tally.imported += await importAllForUser(c.user_id);

      if (c.sync_enabled) {
        // Retry personal events that still need pushing.
        const { data: pending } = await admin
          .from("calendar_personal_events")
          .select("id")
          .eq("user_id", c.user_id)
          .eq("source", "longrein")
          .eq("sync_to_google", true)
          .or("google_event_id.is.null,sync_status.eq.pending,sync_status.eq.error")
          .limit(100);
        for (const p of (pending ?? []) as { id: string }[]) {
          await pushPersonalEvent(c.user_id, p.id).catch(() => {});
          tally.pushed += 1;
        }
        // Push lessons/trainings to the owner's Google write-target calendar.
        tally.pushed += await pushLessonsForUser(c.user_id).catch(() => 0);
      }
    } catch {
      tally.errors += 1;
    }
  }
  return tally;
}

/** Manual "Sync now" for a single user (triggered from Settings). Imports
 *  Google events and pushes Longrein lessons out to Google immediately. */
export async function syncNowForUser(userId: string): Promise<number> {
  await ensureWatchChannels(userId).catch(() => {});
  const imported = await importAllForUser(userId);
  await pushLessonsForUser(userId).catch(() => 0);
  return imported;
}
