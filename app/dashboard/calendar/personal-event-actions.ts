"use server";

// Personal calendar event actions. The form sends wall-clock local
// ("YYYY-MM-DDTHH:mm") values the user typed in Vilnius time; we convert
// to ISO instants here (DST-correct), mirroring farrier-actions.
// Google push for sync_to_google events is handled separately by the
// sync engine (phase: Longrein→Google) so these actions stay fast.

import { revalidatePath } from "next/cache";
import {
  createPersonalEvent,
  updatePersonalEvent,
  deletePersonalEvent,
  type PersonalEventType,
} from "@/services/personalEvents";
import { toFriendlyError } from "@/lib/errors/friendly";

export type PersonalEventResult = { ok: boolean; error: string | null };

const APP_TZ = "Europe/Vilnius";
function localToISO(local: string): string {
  const [date, time] = local.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time ?? "00:00").split(":").map(Number);
  const utcGuess = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
  const inZone = new Date(new Date(utcGuess).toLocaleString("en-US", { timeZone: APP_TZ })).getTime();
  const inUTC = new Date(new Date(utcGuess).toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  const offset = inZone - inUTC;
  return new Date(utcGuess - offset).toISOString();
}

const VALID_TYPES: PersonalEventType[] = ["personal", "work", "family", "travel", "appointment", "other"];

function readType(fd: FormData): PersonalEventType {
  const t = String(fd.get("event_type") ?? "personal");
  return (VALID_TYPES as string[]).includes(t) ? (t as PersonalEventType) : "personal";
}

function readTimes(fd: FormData): { starts_at: string; ends_at: string; all_day: boolean } {
  const allDay = String(fd.get("all_day") ?? "") === "true";
  if (allDay) {
    // All-day: form sends a date (YYYY-MM-DD) in all_day_date and optional
    // all_day_end. Span [date 00:00, (end||date)+1 00:00) local.
    const startDate = String(fd.get("all_day_date") ?? "").slice(0, 10);
    const endDate = String(fd.get("all_day_end") ?? "").slice(0, 10) || startDate;
    const starts = localToISO(`${startDate}T00:00`);
    // end is exclusive next-midnight of the last covered day
    const endPlus = new Date(`${endDate}T00:00:00Z`);
    endPlus.setUTCDate(endPlus.getUTCDate() + 1);
    const ends = localToISO(`${endPlus.toISOString().slice(0, 10)}T00:00`);
    return { starts_at: starts, ends_at: ends, all_day: true };
  }
  return {
    starts_at: localToISO(String(fd.get("starts_at") ?? "")),
    ends_at: localToISO(String(fd.get("ends_at") ?? "")),
    all_day: false,
  };
}

function readRecurrence(fd: FormData): string[] | null {
  // Simple presets → RRULE (Google-compatible). "custom" passes a raw RRULE.
  const repeat = String(fd.get("repeat") ?? "none");
  switch (repeat) {
    case "daily": return ["RRULE:FREQ=DAILY"];
    case "weekly": return ["RRULE:FREQ=WEEKLY"];
    case "monthly": return ["RRULE:FREQ=MONTHLY"];
    case "custom": {
      const raw = String(fd.get("custom_rrule") ?? "").trim();
      return raw ? [raw.startsWith("RRULE:") ? raw : `RRULE:${raw}`] : null;
    }
    default: return null;
  }
}

function revalidateAll() {
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
}

export async function createPersonalEventAction(fd: FormData): Promise<PersonalEventResult> {
  const title = String(fd.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "Add a title." };
  try {
    const { starts_at, ends_at, all_day } = readTimes(fd);
    await createPersonalEvent({
      title,
      event_type: readType(fd),
      starts_at,
      ends_at,
      all_day,
      notes: String(fd.get("notes") ?? "") || null,
      location: String(fd.get("location") ?? "") || null,
      recurrence: readRecurrence(fd),
      sync_to_google: String(fd.get("sync_to_google") ?? "") === "true",
    });
    revalidateAll();
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: toFriendlyError(err).message };
  }
}

export async function updatePersonalEventAction(fd: FormData): Promise<PersonalEventResult> {
  const id = String(fd.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing event." };
  const title = String(fd.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "Add a title." };
  try {
    const { starts_at, ends_at, all_day } = readTimes(fd);
    await updatePersonalEvent(id, {
      title,
      event_type: readType(fd),
      starts_at,
      ends_at,
      all_day,
      notes: String(fd.get("notes") ?? "") || null,
      location: String(fd.get("location") ?? "") || null,
      recurrence: readRecurrence(fd),
      sync_to_google: String(fd.get("sync_to_google") ?? "") === "true",
    });
    revalidateAll();
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: toFriendlyError(err).message };
  }
}

export async function deletePersonalEventAction(fd: FormData): Promise<PersonalEventResult> {
  const id = String(fd.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing event." };
  try {
    await deletePersonalEvent(id);
    revalidateAll();
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: toFriendlyError(err).message };
  }
}
