// Arenas service — physical riding-space registry.
// One stable can run lessons in parallel only across distinct arenas;
// migration 63 introduces this table and points lessons.arena_id at it.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";

export type ArenaRow = {
  id:         string;
  stable_id:  string;
  name:       string;
  surface:    string | null;
  color:      string;
  active:     boolean;
  created_at: string;
  updated_at: string;
};

/** List arenas for the caller's stable. By default returns active only. */
export async function listArenas(opts: { activeOnly?: boolean } = {}): Promise<ArenaRow[]> {
  await getSession();
  const supabase = createSupabaseServerClient();
  let q = supabase.from("arenas").select("*").order("name");
  if (opts.activeOnly !== false) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ArenaRow[];
}

export async function createArena(input: {
  name:    string;
  surface?: string | null;
  color?:   string;
}): Promise<ArenaRow> {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const name = input.name.trim();
  if (!name) throw new Error("ARENA_NAME_REQUIRED");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("arenas")
    .insert({
      stable_id: session.stableId,
      name,
      surface:   input.surface?.trim() || null,
      color:     input.color || "#1E3A2A",
      active:    true,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("ARENA_NAME_DUPLICATE");
    throw error;
  }
  return data as ArenaRow;
}

export async function updateArena(id: string, patch: Partial<{
  name:    string;
  surface: string | null;
  color:   string;
  active:  boolean;
}>): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  void session;

  const supabase = createSupabaseServerClient();
  const update: Record<string, unknown> = {};
  if (patch.name    !== undefined) update.name    = patch.name.trim();
  if (patch.surface !== undefined) update.surface = patch.surface ? patch.surface.trim() : null;
  if (patch.color   !== undefined) update.color   = patch.color;
  if (patch.active  !== undefined) update.active  = patch.active;

  const { error } = await supabase.from("arenas").update(update).eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error("ARENA_NAME_DUPLICATE");
    throw error;
  }
}

/** Soft-deactivate an arena. Doesn't delete — historic lessons keep
 *  pointing at it so finance reports still resolve the arena name. */
export async function deactivateArena(id: string): Promise<void> {
  return updateArena(id, { active: false });
}

/** Returns true when no other CONFIRMED lesson overlaps the candidate
 *  window in the same arena. Skips when arenaId is null (TBD arena). */
export async function isArenaSlotFree(
  arenaId:  string | null,
  startsAt: string,
  endsAt:   string,
  excludeLessonId?: string,
): Promise<boolean> {
  if (!arenaId) return true;
  await getSession();
  const supabase = createSupabaseServerClient();
  let q = supabase
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("arena_id", arenaId)
    .in("status", ["scheduled", "completed"])
    .lt("starts_at", endsAt)
    .gt("ends_at",   startsAt);
  if (excludeLessonId) q = q.neq("id", excludeLessonId);
  const { count, error } = await q;
  if (error) throw error;
  return (count ?? 0) === 0;
}
