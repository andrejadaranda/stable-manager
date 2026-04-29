"use server";

import { revalidatePath } from "next/cache";
import {
  createReminder,
  setReminderCompleted,
  deleteReminder,
} from "@/services/reminders";
import { toFriendlyError } from "@/lib/errors/friendly";

export type ReminderActionState = {
  error: string | null;
  success: boolean;
};

const initial: ReminderActionState = { error: null, success: false };

export async function createReminderAction(
  _prev: ReminderActionState,
  formData: FormData,
): Promise<ReminderActionState> {
  const body        = String(formData.get("body") ?? "").trim();
  const assignedRaw = String(formData.get("assigned_to") ?? "").trim();
  const dueRaw      = String(formData.get("due_at") ?? "").trim();

  if (!body) return { ...initial, error: "Reminder cannot be empty." };

  let dueIso: string | null = null;
  if (dueRaw) {
    const d = new Date(dueRaw);
    if (Number.isNaN(d.getTime())) {
      return { ...initial, error: "Invalid due date." };
    }
    dueIso = d.toISOString();
  }

  try {
    await createReminder({
      body,
      assignedTo: assignedRaw || null,
      dueAt:      dueIso,
    });
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reminders");
  return { error: null, success: true };
}

export async function toggleReminderAction(
  _prev: ReminderActionState,
  formData: FormData,
): Promise<ReminderActionState> {
  const id     = String(formData.get("reminder_id") ?? "");
  const wasOpen = String(formData.get("was_open") ?? "true") === "true";
  if (!id) return { ...initial, error: "Missing id." };

  try {
    await setReminderCompleted(id, wasOpen ? new Date().toISOString() : null);
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reminders");
  return { error: null, success: true };
}

export async function deleteReminderAction(
  _prev: ReminderActionState,
  formData: FormData,
): Promise<ReminderActionState> {
  const id = String(formData.get("reminder_id") ?? "");
  if (!id) return { ...initial, error: "Missing id." };

  try {
    await deleteReminder(id);
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reminders");
  return { error: null, success: true };
}
