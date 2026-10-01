// Google <-> Longrein synchronization engine (server-only, service-role).
//
// Google -> Longrein (import):
//   * events.list with a persisted syncToken (incremental); initial sync uses
//     a timeMin/timeMax window. 410 GONE -> drop token and full-resync.
//   * singleEvents=true, so recurring events arrive as concrete instances and
//     overnight shifts arrive as single rows with real start/end instants.
//   * status==='cancelled' -> delete the local mirror row.
//   * Loop guard: an event carrying our extendedProperties.private.longreinId
//     is one WE pushed — we reconcile the originating row instead of inserting
//     a duplicate google-source row.
//
// Longrein -> Google (push):
//   * personal events with sync_to_google, and (optionally) lessons, are
//     written to the connection's write-target calendar, stamped with
//     extendedProperties so re-import can't duplicate them. Mapping ids are
//     stored (inline on personal events, in calendar_event_mappings for
//     lessons) so edits/deletes propagate and loops are prevented.

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getConnectionAdmin, getValidAccessToken } from "@/services/googleCalendar";
import {
  listEventsPage,
  insertEvent,
  patchEvent,
  deleteEvent,
  GoogleApiError,
  type GoogleEvent,
  type EventWrite,
} from "@/lib/google/client";

const APP_TZ = "Europe/Vilnius";
const LONGREIN_ID = "longreinId"; // extendedProperties.private key
const LONGREIN_KIND = "longreinKind";

// ---------- date helpers ----------

/** 'YYYY-MM-DD' interpreted at 00:00 Europe/Vilnius -> ISO instant. */
function localDateToISO(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const utcGuess = Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
  const inZone = new Date(new Date(utcGuess).toLocaleString("en-US", { timeZone: APP_TZ })).getTime();
  const inUTC = new Date(new Date(utcGuess).toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(utcGuess - (inZone - inUTC)).toISOString();
}

/** Parse a Google event's start/end into our storage shape. */
function fromGoogle(e: GoogleEvent): { all_day: boolean; starts_at: string; ends_at: string } | null {
  if (e.start?.dateTime && e.end?.dateTime) {
    return { all_day: false, starts_at: new Date(e.start.dateTime).toISOString(), ends_at: new Date(e.end.dateTime).toISOString() };
  }
  if (e.start?.date && e.end?.date) {
    // Google all-day end.date is exclusive — matches our next-midnight convention.
    return { all_day: true, starts_at: localDateToISO(e.start.date), ends_at: localDateToISO(e.end.date) };
  }
  return null;
}

/** Build a Google event body from a Longrein timed/all-day event. */
function toGoogleWrite(ev: {
  title: string;
  notes: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  recurrence: string[] | null;
}, longreinId: string, kind: string): EventWrite {
  const extendedPrivate = { [LONGREIN_ID]: longreinId, [LONGREIN_KIND]: kind };
  if (ev.all_day) {
    const startDate = new Date(ev.starts_at).toLocaleDateString("en-CA", { timeZone: APP_TZ });
    const endDate = new Date(ev.ends_at).toLocaleDateString("en-CA", { timeZone: APP_TZ });
    return {
      summary: ev.title,
      description: ev.notes,
      location: ev.location,
      start: { date: startDate },
      end: { date: endDate },
      recurrence: ev.recurrence,
      extendedPrivate,
    };
  }
  return {
    summary: ev.title,
    description: ev.notes,
    location: ev.location,
    start: { dateTime: new Date(ev.starts_at).toISOString(), timeZone: APP_TZ },
    end: { dateTime: new Date(ev.ends_at).toISOString(), timeZone: APP_TZ },
    recurrence: ev.recurrence,
    extendedPrivate,
  };
}

// ============================================================
// Google -> Longrein import
// ============================================================

/** Import one calendar for a user. Incremental when a syncToken exists; full
 *  window otherwise. Returns the number of changes applied. */
export async function importCalendar(userId: string, calPk: string): Promise<number> {
  const admin = createSupabaseAdminClient();
  const conn = await getConnectionAdmin(userId);
  if (!conn) return 0;
  const { data: cal } = await admin
    .from("google_calendars")
    .select("id, google_calendar_id, summary, sync_token, read_enabled")
    .eq("id", calPk)
    .maybeSingle();
  if (!cal || !(cal as { read_enabled: boolean }).read_enabled) return 0;
  const calRow = cal as { id: string; google_calendar_id: string; summary: string | null; sync_token: string | null };

  const token = await getValidAccessToken(conn);
  let syncToken = calRow.sync_token ?? undefined;
  let pageToken: string | undefined;
  let changes = 0;
  let newSyncToken: string | undefined;

  // Full-window bounds used on first sync or after a 410.
  const fullMin = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const fullMax = new Date(Date.now() + 180 * 86_400_000).toISOString();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let page;
    try {
      page = await listEventsPage(token, calRow.google_calendar_id, {
        syncToken,
        timeMin: syncToken ? undefined : fullMin,
        timeMax: syncToken ? undefined : fullMax,
        pageToken,
      });
    } catch (err) {
      if (err instanceof GoogleApiError && err.status === 410) {
        // Sync token expired — wipe this calendar's imported mirror + token,
        // and restart a full sync.
        await admin.from("calendar_personal_events").delete().eq("user_id", userId).eq("source", "google").eq("google_calendar_id", calRow.google_calendar_id);
        await admin.from("google_calendars").update({ sync_token: null }).eq("id", calRow.id);
        syncToken = undefined;
        pageToken = undefined;
        continue;
      }
      throw err;
    }

    for (const e of page.items) {
      changes += await applyImportedEvent(userId, calRow.google_calendar_id, e);
    }

    if (page.nextPageToken) {
      pageToken = page.nextPageToken;
      continue;
    }
    newSyncToken = page.nextSyncToken;
    break;
  }

  if (newSyncToken) {
    await admin.from("google_calendars").update({ sync_token: newSyncToken, sync_token_updated_at: new Date().toISOString(), last_full_sync_at: calRow.sync_token ? undefined : new Date().toISOString() }).eq("id", calRow.id);
  }
  return changes;
}

async function applyImportedEvent(userId: string, calendarId: string, e: GoogleEvent): Promise<number> {
  const admin = createSupabaseAdminClient();
  const longreinId = e.extendedProperties?.private?.[LONGREIN_ID];

  // Deletion / cancellation.
  if (e.status === "cancelled") {
    if (longreinId) {
      // Our own pushed event was deleted on Google — clear its link (and, if
      // it was a personal event, we leave the Longrein row; the user deletes
      // it in Longrein if they want). Remove the mapping.
      await admin.from("calendar_event_mappings").delete().eq("user_id", userId).eq("google_event_id", e.id);
    } else {
      await admin.from("calendar_personal_events").delete().eq("user_id", userId).eq("source", "google").eq("google_calendar_id", calendarId).eq("google_event_id", e.id);
    }
    return 1;
  }

  const when = fromGoogle(e);
  if (!when) return 0;

  // Loop guard: an event WE pushed. Reconcile the originating row's link
  // rather than inserting a duplicate google-source mirror.
  if (longreinId) {
    const kind = e.extendedProperties?.private?.[LONGREIN_KIND];
    if (kind === "personal") {
      await admin
        .from("calendar_personal_events")
        .update({ google_calendar_id: calendarId, google_event_id: e.id, google_updated_at: e.updated ?? null, provider: "google", last_synced_at: new Date().toISOString(), sync_status: "ok" })
        .eq("id", longreinId)
        .eq("user_id", userId);
    } else {
      // lesson/farrier mapping
      await admin.from("calendar_event_mappings").upsert(
        { user_id: userId, stable_id: (await getConnectionAdmin(userId))?.stable_id, provider: "google", longrein_kind: kind ?? "lesson", longrein_event_id: longreinId, google_calendar_id: calendarId, google_event_id: e.id, google_updated_at: e.updated ?? null, last_synced_at: new Date().toISOString() },
        { onConflict: "user_id,longrein_kind,longrein_event_id,provider" },
      );
    }
    return 0;
  }

  // Genuine external event — upsert the mirror row (unique on user+cal+event).
  const stableId = (await getConnectionAdmin(userId))?.stable_id;
  await admin.from("calendar_personal_events").upsert(
    {
      user_id: userId,
      stable_id: stableId,
      title: e.summary || "(no title)",
      event_type: "personal",
      starts_at: when.starts_at,
      ends_at: when.ends_at,
      all_day: when.all_day,
      notes: e.description ?? null,
      location: e.location ?? null,
      source: "google",
      provider: "google",
      google_calendar_id: calendarId,
      google_event_id: e.id,
      google_ical_uid: e.iCalUID ?? null,
      google_recurring_event_id: e.recurringEventId ?? null,
      google_updated_at: e.updated ?? null,
      sync_status: "ok",
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,google_calendar_id,google_event_id" },
  );
  return 1;
}

/** Import every read-enabled calendar for a user. */
export async function importAllForUser(userId: string): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { data: cals } = await admin.from("google_calendars").select("id").eq("user_id", userId).eq("read_enabled", true);
  let total = 0;
  for (const c of (cals ?? []) as { id: string }[]) {
    total += await importCalendar(userId, c.id).catch(() => 0);
  }
  return total;
}

// ============================================================
// Longrein -> Google push
// ============================================================

/** Push (create or update) a single personal event to Google if it is
 *  flagged sync_to_google and the connection has a write target. */
export async function pushPersonalEvent(userId: string, eventId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const conn = await getConnectionAdmin(userId);
  if (!conn || conn.status !== "connected" || !conn.write_calendar_id) return;

  const { data: ev } = await admin
    .from("calendar_personal_events")
    .select("id, title, notes, location, starts_at, ends_at, all_day, recurrence, source, sync_to_google, google_event_id, google_calendar_id")
    .eq("id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!ev) return;
  const row = ev as {
    id: string; title: string; notes: string | null; location: string | null;
    starts_at: string; ends_at: string; all_day: boolean; recurrence: string[] | null;
    source: string; sync_to_google: boolean; google_event_id: string | null; google_calendar_id: string | null;
  };
  // Never push an imported Google event back to Google.
  if (row.source === "google" || !row.sync_to_google) return;

  const token = await getValidAccessToken(conn);
  const write = toGoogleWrite(row, row.id, "personal");

  try {
    if (row.google_event_id && row.google_calendar_id) {
      await patchEvent(token, row.google_calendar_id, row.google_event_id, write);
    } else {
      const created = await insertEvent(token, conn.write_calendar_id, write);
      await admin
        .from("calendar_personal_events")
        .update({ google_event_id: created.id, google_calendar_id: conn.write_calendar_id, provider: "google", google_updated_at: created.updated ?? null, sync_status: "ok", last_synced_at: new Date().toISOString() })
        .eq("id", row.id);
    }
  } catch {
    await admin.from("calendar_personal_events").update({ sync_status: "error" }).eq("id", row.id);
  }
}

/** Delete a personal event's Google mirror (call BEFORE removing the local
 *  row, passing its google ids). Best-effort. */
export async function deletePushedPersonalEvent(userId: string, googleCalendarId: string, googleEventId: string): Promise<void> {
  const conn = await getConnectionAdmin(userId);
  if (!conn) return;
  try {
    const token = await getValidAccessToken(conn);
    await deleteEvent(token, googleCalendarId, googleEventId);
  } catch {
    /* best-effort */
  }
}
