"use server";

// Server actions for the Google Calendar integration settings page.

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import {
  setCalendarRead,
  setWriteTarget,
  setSyncEnabled,
  syncCalendarList,
  disconnectGoogle,
} from "@/services/googleCalendar";
import { ensureWatchChannels, stopAllChannels } from "@/lib/google/channels";
import { syncNowForUser } from "@/lib/google/reconcile";
import { toFriendlyError } from "@/lib/errors/friendly";

export type Result = { ok: boolean; error: string | null };

function revalidate() {
  revalidatePath("/dashboard/settings/integrations");
  revalidatePath("/dashboard/calendar");
}

export async function setCalendarReadAction(fd: FormData): Promise<Result> {
  const pk = String(fd.get("calendar_pk") ?? "");
  const read = String(fd.get("read") ?? "") === "true";
  if (!pk) return { ok: false, error: "Missing calendar." };
  try {
    await setCalendarRead(pk, read);
    const s = await getSession();
    // Spin up a watch channel + first import for a newly enabled calendar.
    if (read) {
      await ensureWatchChannels(s.userId).catch(() => {});
      await syncNowForUser(s.userId).catch(() => {});
    }
    revalidate();
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: toFriendlyError(err).message };
  }
}

export async function setWriteTargetAction(fd: FormData): Promise<Result> {
  const pk = String(fd.get("calendar_pk") ?? "");
  if (!pk) return { ok: false, error: "Missing calendar." };
  try {
    await setWriteTarget(pk);
    revalidate();
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: toFriendlyError(err).message };
  }
}

export async function setSyncEnabledAction(fd: FormData): Promise<Result> {
  const enabled = String(fd.get("enabled") ?? "") === "true";
  try {
    await setSyncEnabled(enabled);
    revalidate();
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: toFriendlyError(err).message };
  }
}

export async function refreshCalendarsAction(): Promise<Result> {
  try {
    const s = await getSession();
    await syncCalendarList(s.userId);
    revalidate();
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: toFriendlyError(err).message };
  }
}

export async function syncNowAction(): Promise<Result> {
  try {
    const s = await getSession();
    await syncNowForUser(s.userId);
    revalidate();
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: toFriendlyError(err).message };
  }
}

export async function disconnectGoogleAction(): Promise<Result> {
  try {
    const s = await getSession();
    // Stop watch channels at Google first, then revoke + delete local mirror.
    await stopAllChannels(s.userId).catch(() => {});
    await disconnectGoogle(s.userId);
    revalidate();
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: toFriendlyError(err).message };
  }
}
