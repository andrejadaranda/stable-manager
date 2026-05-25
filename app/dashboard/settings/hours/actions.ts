"use server";

import { revalidatePath } from "next/cache";
import { upsertWorkingHour, deleteWorkingHour, addHoliday, removeHoliday } from "@/services/workingHours";

export async function saveDayAction(formData: FormData): Promise<{ error: string | null }> {
  const day = Number(formData.get("day_of_week"));
  const open  = String(formData.get("open_time")  ?? "");
  const close = String(formData.get("close_time") ?? "");
  if (!/^\d{2}:\d{2}/.test(open) || !/^\d{2}:\d{2}/.test(close)) {
    return { error: "Invalid time format." };
  }
  if (close <= open) {
    return { error: "Close time must be after open time." };
  }
  try {
    await upsertWorkingHour(day, open + ":00", close + ":00");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed." };
  }
  revalidatePath("/dashboard/settings/hours");
  return { error: null };
}

export async function closeDayAction(day_of_week: number): Promise<void> {
  await deleteWorkingHour(day_of_week);
  revalidatePath("/dashboard/settings/hours");
}

export async function addHolidayAction(formData: FormData): Promise<{ error: string | null }> {
  const closed_date = String(formData.get("closed_date") ?? "");
  const label       = String(formData.get("label")       ?? "").trim() || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(closed_date)) {
    return { error: "Pick a valid date." };
  }
  try {
    await addHoliday(closed_date, label);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed." };
  }
  revalidatePath("/dashboard/settings/hours");
  return { error: null };
}

export async function removeHolidayAction(id: string): Promise<void> {
  await removeHoliday(id);
  revalidatePath("/dashboard/settings/hours");
}
