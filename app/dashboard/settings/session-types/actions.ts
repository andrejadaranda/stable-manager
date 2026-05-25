"use server";

import { revalidatePath } from "next/cache";
import {
  createStableSessionType,
  updateStableSessionType,
  deleteStableSessionType,
} from "@/services/stableSessionTypes";

export type CrudState = { error: string | null; success: boolean };

export async function createTypeAction(
  _prev: CrudState,
  formData: FormData,
): Promise<CrudState> {
  const label = String(formData.get("label") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim();
  if (label.length < 2) return { error: "Label too short.", success: false };
  if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return { error: "Invalid color.", success: false };
  }
  try {
    await createStableSessionType({ label, color: color || null });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create.", success: false };
  }
  revalidatePath("/dashboard/settings/session-types");
  return { error: null, success: true };
}

export async function toggleActiveAction(id: string, active: boolean): Promise<void> {
  await updateStableSessionType(id, { active });
  revalidatePath("/dashboard/settings/session-types");
}

export async function renameAction(id: string, label: string): Promise<{ error: string | null }> {
  if (!label.trim()) return { error: "Label required." };
  try {
    await updateStableSessionType(id, { label });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed." };
  }
  revalidatePath("/dashboard/settings/session-types");
  return { error: null };
}

export async function recolorAction(id: string, color: string | null): Promise<void> {
  await updateStableSessionType(id, { color });
  revalidatePath("/dashboard/settings/session-types");
}

export async function deleteTypeAction(id: string): Promise<void> {
  await deleteStableSessionType(id);
  revalidatePath("/dashboard/settings/session-types");
}
