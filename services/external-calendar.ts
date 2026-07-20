// External calendar IMPORT — the second half of calendar sync.
//
// A user (e.g. the owner) subscribes Longrein to a read-only .ics feed of
// someone else's calendar — typically a spouse's work calendar. Longrein polls
// that feed and writes its events into `availability_blocks` so lessons can't
// be booked over them. Blocks written by this importer are tagged
// (source='external', external_profile_id=<owner profile>) so each resync
// cleanly replaces the previous import without touching manually-added blocks.
//
// Direction is one-way (external → Longrein). The export half lives in
// /api/calendar/[token]. Together they let the owner run a single calendar.

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";
import { parseIcsBusy, type BusyWindow } from "@/lib/calendar/ics";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

// Import window: a week back (to cover in-progress shifts) through ~4 months
// ahead. Matches how far out lessons realistically get scheduled.
const IMPORT_BACK_DAYS = 7;
const IMPORT_AHEAD_DAYS = 120;

export type ExternalCalendarConfig = {
  url: string | null;
  label: string | null;
  syncedAt: string | null;
  status: string | null;
  blockCount: number;
};

/** Read the signed-in user's external-calendar config + how many blocks it produced. */
export async function getExternalCalendarConfig(): Promise<ExternalCalendarConfig> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  const supabase = createSupabaseServerClient();

  const { data } = await supabase
    .from("profiles")
    .select("external_calendar_url, external_calendar_label, external_calendar_synced_at, external_calendar_status")
    .eq("id", session.userId)
    .maybeSingle();
  const p = (data ?? {}) as {
    external_calendar_url?: string | null;
    external_calendar_label?: string | null;
    external_calendar_synced_at?: string | null;
    external_calendar_status?: string | null;
  };

  const { count } = await supabase
    .from("availability_blocks")
    .select("id", { count: "exact", head: true })
    .eq("source", "external")
    .eq("external_profile_id", session.userId);

  return {
    url: p.external_calendar_url ?? null,
    label: p.external_calendar_label ?? null,
    syncedAt: p.external_calendar_synced_at ?? null,
    status: p.external_calendar_status ?? null,
    blockCount: count ?? 0,
  };
}

/** Normalise webcal:// → https:// and validate scheme. Throws BAD_URL otherwise. */
function normaliseFeedUrl(raw: string): string {
  let url = raw.trim();
  if (url.toLowerCase().startsWith("webcal://")) url = "https://" + url.slice("webcal://".length);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("BAD_URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("BAD_URL");
  return parsed.toString();
}

/**
 * Save the feed URL on the signed-in user's profile and immediately sync.
 * Returns the resulting block count. Throws BAD_URL / FETCH_FAILED / EMPTY_FEED.
 */
export async function setExternalCalendar(rawUrl: string, label: string | null): Promise<{ blocks: number }> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  const url = normaliseFeedUrl(rawUrl);

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      external_calendar_url: url,
      external_calendar_label: label?.trim() || null,
    })
    .eq("id", session.userId);
  if (error) throw error;

  // Sync now with the admin client (blocks are stable-scoped; writing needs to
  // bypass nothing here since the user is staff, but the shared core uses admin
  // so the cron path and the interactive path are identical).
  const admin = createSupabaseAdminClient();
  const res = await syncProfileExternalCalendar(admin, {
    id: session.userId,
    stable_id: session.stableId,
    url,
  });
  return { blocks: res.blocks };
}

/** Remove the feed and delete every block it created for this user. */
export async function clearExternalCalendar(): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  const supabase = createSupabaseServerClient();

  await supabase.from("availability_blocks")
    .delete()
    .eq("source", "external")
    .eq("external_profile_id", session.userId);

  const { error } = await supabase
    .from("profiles")
    .update({
      external_calendar_url: null,
      external_calendar_label: null,
      external_calendar_synced_at: null,
      external_calendar_status: null,
    })
    .eq("id", session.userId);
  if (error) throw error;
}

/** Re-sync the signed-in user's already-saved feed. Throws if none configured. */
export async function resyncExternalCalendar(): Promise<{ blocks: number }> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("external_calendar_url")
    .eq("id", session.userId)
    .maybeSingle();
  const url = (data as { external_calendar_url?: string | null } | null)?.external_calendar_url ?? null;
  if (!url) throw new Error("NO_FEED");

  const admin = createSupabaseAdminClient();
  const res = await syncProfileExternalCalendar(admin, {
    id: session.userId,
    stable_id: session.stableId,
    url,
  });
  return { blocks: res.blocks };
}

// ---------------------------------------------------------------------------
// Core sync — shared by the interactive path and the cron. Fetches the feed,
// parses it, and replaces this profile's external blocks in one transaction-ish
// pass (delete-then-insert; a mid-flight failure leaves the old blocks removed
// but the status column records the error so the UI can surface it).
// ---------------------------------------------------------------------------
export async function syncProfileExternalCalendar(
  admin: Admin,
  profile: { id: string; stable_id: string; url: string },
): Promise<{ blocks: number; status: string }> {
  const now = Date.now();
  const windowStartMs = now - IMPORT_BACK_DAYS * 86_400_000;
  const windowEndMs = now + IMPORT_AHEAD_DAYS * 86_400_000;

  let status = "ok";
  let windows: BusyWindow[] = [];
  try {
    const res = await fetch(profile.url, {
      cache: "no-store",
      redirect: "follow",
      headers: { Accept: "text/calendar, text/plain, */*" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      status = `fetch_failed_${res.status}`;
    } else {
      const text = await res.text();
      if (!/BEGIN:VCALENDAR/i.test(text)) {
        status = "not_a_calendar";
      } else {
        windows = parseIcsBusy(text, { windowStartMs, windowEndMs });
      }
    }
  } catch (err: any) {
    status = err?.name === "TimeoutError" ? "timeout" : "fetch_error";
  }

  // Only replace existing blocks when we actually got a good parse. A transient
  // fetch error should NOT wipe the last good import.
  if (status === "ok") {
    await admin.from("availability_blocks")
      .delete()
      .eq("source", "external")
      .eq("external_profile_id", profile.id);

    if (windows.length > 0) {
      const rows = windows.slice(0, 1000).map((w) => ({
        stable_id: profile.stable_id,
        starts_at: w.startISO,
        ends_at: w.endISO,
        all_day: w.allDay,
        reason: w.summary ? truncate(w.summary, 120) : "Busy (imported)",
        source: "external",
        external_profile_id: profile.id,
        external_uid: truncate(w.uid, 300),
        created_by: profile.id,
      }));
      const { error } = await admin.from("availability_blocks").insert(rows);
      if (error) status = `insert_failed`;
    }
  }

  await admin.from("profiles").update({
    external_calendar_synced_at: new Date().toISOString(),
    external_calendar_status: status,
  }).eq("id", profile.id);

  return { blocks: status === "ok" ? windows.length : 0, status };
}

/**
 * Cron entry point — resync every profile that has a feed configured.
 * Called from the reminders cron so it stays within Vercel's cron quota.
 */
export async function syncAllExternalCalendars(
  admin: Admin,
): Promise<{ profiles: number; blocks: number; failed: number }> {
  const tally = { profiles: 0, blocks: 0, failed: 0 };
  const { data } = await admin
    .from("profiles")
    .select("id, stable_id, external_calendar_url")
    .not("external_calendar_url", "is", null);
  const profiles = (data ?? []) as Array<{ id: string; stable_id: string; external_calendar_url: string }>;

  for (const p of profiles) {
    tally.profiles += 1;
    try {
      const res = await syncProfileExternalCalendar(admin, {
        id: p.id,
        stable_id: p.stable_id,
        url: p.external_calendar_url,
      });
      tally.blocks += res.blocks;
      if (res.status !== "ok") tally.failed += 1;
    } catch {
      tally.failed += 1;
    }
  }
  return tally;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) : s;
}
