"use server";

import { revalidatePath } from "next/cache";
import {
  createArena,
  updateArena,
  deactivateArena,
} from "@/services/arenas";

export type ArenasState = { error: string | null; success: boolean };
const initial: ArenasState = { error: null, success: false };

export async function createArenaAction(
  _prev: ArenasState,
  fd: FormData,
): Promise<ArenasState> {
  const name    = String(fd.get("name") ?? "").trim();
  const surface = String(fd.get("surface") ?? "").trim() || null;
  const color   = String(fd.get("color") ?? "#1E3A2A");
  if (!name) return { ...initial, error: "Name required." };
  try {
    await createArena({ name, surface, color });
  } catch (err) {
    const msg = (err as Error)?.message ?? "Failed to create arena.";
    if (msg === "ARENA_NAME_DUPLICATE") return { ...initial, error: "An arena with that name already exists." };
    return { ...initial, error: msg };
  }
  revalidatePath("/dashboard/settings/arenas");
  revalidatePath("/dashboard/calendar");
  return { error: null, success: true };
}

export async function updateArenaAction(
  _prev: ArenasState,
  fd: FormData,
): Promise<ArenasState> {
  const id      = String(fd.get("id") ?? "");
  const name    = String(fd.get("name") ?? "").trim();
  const surface = String(fd.get("surface") ?? "").trim() || null;
  const color   = String(fd.get("color") ?? "#1E3A2A");
  if (!id || !name) return { ...initial, error: "Missing fields." };
  try {
    await updateArena(id, { name, surface, color });
  } catch (err) {
    const msg = (err as Error)?.message ?? "Failed to save.";
    if (msg === "ARENA_NAME_DUPLICATE") return { ...initial, error: "An arena with that name already exists." };
    return { ...initial, error: msg };
  }
  revalidatePath("/dashboard/settings/arenas");
  revalidatePath("/dashboard/calendar");
  return { error: null, success: true };
}

export async function deactivateArenaAction(
  _prev: ArenasState,
  fd: FormData,
): Promise<ArenasState> {
  const id = String(fd.get("id") ?? "");
  if (!id) return { ...initial, error: "Missing id." };
  try {
    await deactivateArena(id);
  } catch (err) {
    return { ...initial, error: (err as Error)?.message ?? "Failed." };
  }
  revalidatePath("/dashboard/settings/arenas");
  revalidatePath("/dashboard/calendar");
  return { error: null, success: true };
}
