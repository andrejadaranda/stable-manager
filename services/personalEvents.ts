// Personal calendar events — per-user events created inside Longrein plus
// Google-imported events (source='google'). All rows are owned by the
// current user (RLS: user_id = current_user_id()), so one stable member
// never sees another's private events.
//
// Timestamps are stored timestamptz (UTC). Callers pass ISO instants.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import type { CalendarPersonalEvent, PersonalEventType } from "./calendarEvents.pure";

export type { CalendarPersonalEvent, PersonalEventType } from "./calendarEvents.pure";

const SELECT_COLS =
  "id, title, event_type, starts_at, ends_at, all_day, notes, location, color, source, sync_to_google, recurrence, google_calendar_id, google_event_id";

type Row = {
  id: string;
  title: string;
  event_type: PersonalEventType;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  notes: string | null;
  location: string | null;
  color: string | null;
  source: "longrein" | "google";
  sync_to_google: boolean;
  recurrence: string[] | null;
  google_calendar_id: string | null;
  google_event_id: string | null;
};

function toView(r: Row, calNames?: Map<string, string>): CalendarPersonalEvent {
  return {
    id: r.id,
    title: r.title,
    event_type: r.event_type,
    starts_at: r.starts_at,
    ends_at: r.ends_at,
    all_day: r.all_day,
    notes: r.notes,
    location: r.location,
    color: r.color,
    source: r.source,
    sync_to_google: r.sync_to_google,
    recurrence: r.recurrence,
    google_calendar_id: r.google_calendar_id,
    google_event_id: r.google_event_id,
    calendar_name: r.google_calendar_id ? calNames?.get(r.google_calendar_id) ?? null : null,
    event_source: "personal_event",
  };
}

/** Events overlapping [from, to) for the current user. Includes both
 *  Longrein-created and Google-imported events. */
export async function listPersonalEventsForCalendar(from: string, to: string): Promise<CalendarPersonalEvent[]> {
  await getSession();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("calendar_personal_events")
    .select(SELECT_COLS)
    .lt("starts_at", to)
    .gt("ends_at", from)
    .order("starts_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as Row[];

  // Resolve Google calendar names for a friendly "Source: Google · Familija".
  let calNames: Map<string, string> | undefined;
  const googleCalIds = Array.from(new Set(rows.filter((r) => r.google_calendar_id).map((r) => r.google_calendar_id as string)));
  if (googleCalIds.length > 0) {
    const { data: cals } = await supabase
      .from("google_calendars")
      .select("google_calendar_id, summary")
      .in("google_calendar_id", googleCalIds);
    calNames = new Map((cals ?? []).map((c: { google_calendar_id: string; summary: string | null }) => [c.google_calendar_id, c.summary ?? "Google"]));
  }
  return rows.map((r) => toView(r, calNames));
}

export type PersonalEventInput = {
  title: string;
  event_type: PersonalEventType;
  starts_at: string; // ISO
  ends_at: string; // ISO
  all_day?: boolean;
  notes?: string | null;
  location?: string | null;
  recurrence?: string[] | null;
  sync_to_google?: boolean;
};

export async function createPersonalEvent(input: PersonalEventInput): Promise<{ id: string }> {
  const session = await getSession();
  if (!input.title?.trim()) throw new Error("TITLE_REQUIRED");
  if (!input.all_day && new Date(input.ends_at) <= new Date(input.starts_at)) throw new Error("INVALID_TIME_RANGE");
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("calendar_personal_events")
    .insert({
      stable_id: session.stableId,
      user_id: session.userId,
      title: input.title.trim(),
      event_type: input.event_type,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      all_day: input.all_day ?? false,
      notes: input.notes?.trim() || null,
      location: input.location?.trim() || null,
      recurrence: input.recurrence ?? null,
      source: "longrein",
      sync_to_google: input.sync_to_google ?? false,
      sync_status: input.sync_to_google ? "pending" : "ok",
      created_by: session.userId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: (data as { id: string }).id };
}

export async function updatePersonalEvent(id: string, input: Partial<PersonalEventInput>): Promise<void> {
  await getSession();
  const supabase = createSupabaseServerClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.event_type !== undefined) patch.event_type = input.event_type;
  if (input.starts_at !== undefined) patch.starts_at = input.starts_at;
  if (input.ends_at !== undefined) patch.ends_at = input.ends_at;
  if (input.all_day !== undefined) patch.all_day = input.all_day;
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
  if (input.location !== undefined) patch.location = input.location?.trim() || null;
  if (input.recurrence !== undefined) patch.recurrence = input.recurrence;
  if (input.sync_to_google !== undefined) {
    patch.sync_to_google = input.sync_to_google;
    patch.sync_status = input.sync_to_google ? "pending" : "ok";
  }
  // RLS restricts this to the owner's own rows.
  const { error } = await supabase.from("calendar_personal_events").update(patch).eq("id", id);
  if (error) throw error;
}

/** Google linkage for a personal event — used by actions to propagate a
 *  delete to Google before removing the local row. */
export async function getPersonalEventSyncRef(id: string): Promise<{
  source: "longrein" | "google";
  sync_to_google: boolean;
  google_calendar_id: string | null;
  google_event_id: string | null;
} | null> {
  await getSession();
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("calendar_personal_events")
    .select("source, sync_to_google, google_calendar_id, google_event_id")
    .eq("id", id)
    .maybeSingle();
  return (data as { source: "longrein" | "google"; sync_to_google: boolean; google_calendar_id: string | null; google_event_id: string | null }) ?? null;
}

export async function deletePersonalEvent(id: string): Promise<void> {
  await getSession();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("calendar_personal_events").delete().eq("id", id);
  if (error) throw error;
}
