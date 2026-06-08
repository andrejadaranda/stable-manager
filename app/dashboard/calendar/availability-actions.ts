"use server";

import { revalidatePath } from "next/cache";
import { createAvailabilityBlock, deleteAvailabilityBlock } from "@/services/availability";

export type BlockState = { ok: boolean; error: string | null };

export async function createBlockAction(_p: BlockState, fd: FormData): Promise<BlockState> {
  const allDay = fd.get("all_day") === "true" || fd.get("all_day") === "on";
  const reason = String(fd.get("reason") ?? "");

  let starts_at: string;
  let ends_at: string;
  if (allDay) {
    const date = String(fd.get("date") ?? "");
    if (!date) return { ok: false, error: "Pick a date." };
    starts_at = new Date(`${date}T00:00`).toISOString();
    ends_at = new Date(`${date}T23:59`).toISOString();
  } else {
    const s = String(fd.get("starts_at") ?? "");
    const e = String(fd.get("ends_at") ?? "");
    if (!s || !e) return { ok: false, error: "Pick a start and end time." };
    starts_at = new Date(s).toISOString();
    ends_at = new Date(e).toISOString();
  }

  try {
    await createAvailabilityBlock({ starts_at, ends_at, all_day: allDay, reason });
  } catch (err: any) {
    const m = err?.message ?? "";
    if (m === "INVALID_TIME_RANGE") return { ok: false, error: "End must be after start." };
    return { ok: false, error: `Could not save: ${m || "unknown error"}.` };
  }
  revalidatePath("/dashboard/calendar");
  return { ok: true, error: null };
}

export async function deleteBlockAction(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  try {
    await deleteAvailabilityBlock(id);
  } catch {
    /* ignore */
  }
  revalidatePath("/dashboard/calendar");
}
