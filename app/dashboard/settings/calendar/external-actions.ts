"use server";

import { revalidatePath } from "next/cache";
import {
  setExternalCalendar,
  clearExternalCalendar,
  resyncExternalCalendar,
} from "@/services/external-calendar";

export type ExternalState = { ok: boolean; error: string | null; blocks?: number };

function friendly(err: string): string {
  switch (err) {
    case "BAD_URL":       return "That doesn't look like a valid calendar link. Paste the full https:// or webcal:// URL.";
    case "NO_FEED":       return "No calendar link saved yet.";
    case "FORBIDDEN":     return "You don't have permission to do that.";
    default:              return "Something went wrong. Check the link and try again.";
  }
}

export async function saveExternalCalendarAction(_p: ExternalState, fd: FormData): Promise<ExternalState> {
  const url = String(fd.get("url") ?? "").trim();
  const label = String(fd.get("label") ?? "").trim() || null;
  if (!url) return { ok: false, error: "Paste a calendar link first." };
  try {
    const { blocks } = await setExternalCalendar(url, label);
    revalidatePath("/dashboard/settings/calendar");
    revalidatePath("/dashboard/calendar");
    return { ok: true, error: null, blocks };
  } catch (err: any) {
    return { ok: false, error: friendly(err?.message ?? "") };
  }
}

export async function resyncExternalCalendarAction(_p: ExternalState, _fd: FormData): Promise<ExternalState> {
  try {
    const { blocks } = await resyncExternalCalendar();
    revalidatePath("/dashboard/settings/calendar");
    revalidatePath("/dashboard/calendar");
    return { ok: true, error: null, blocks };
  } catch (err: any) {
    return { ok: false, error: friendly(err?.message ?? "") };
  }
}

export async function clearExternalCalendarAction(): Promise<void> {
  try {
    await clearExternalCalendar();
  } catch {
    /* ignore */
  }
  revalidatePath("/dashboard/settings/calendar");
  revalidatePath("/dashboard/calendar");
}
