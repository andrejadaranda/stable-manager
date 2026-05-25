// Per-stable session type CRUD.
//
// Owner can define their own taxonomy ("Naturalus jojimas", "Terapija",
// "FEI Dressage"). When at least one custom type exists, the UI uses
// these. When none exist, falls back to the hardcoded SESSION_TYPES enum.
//
// Storage stays on the `session_type` enum column for backwards compat;
// custom labels are display-only. (Owner-defined types map to 'other'
// in DB session_type for now; v2 will store a free-text type label
// alongside.)

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";

// Pure types live in .pure.ts so client components can import them
// without pulling next/headers. Re-exported here for server callers.
export { type StableSessionType } from "./stableSessionTypes.pure";
import type { StableSessionType } from "./stableSessionTypes.pure";

export async function listStableSessionTypes(): Promise<StableSessionType[]> {
  const ctx = await getSession();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("stable_session_types")
    .select("id, label, color, sort_order, active")
    .eq("stable_id", ctx.stableId)
    .order("sort_order", { ascending: true })
    .order("label",      { ascending: true });
  if (error) throw error;
  return (data ?? []) as StableSessionType[];
}

export async function createStableSessionType(input: {
  label: string;
  color?: string | null;
  sort_order?: number;
}): Promise<{ id: string }> {
  const ctx = await getSession();
  requireRole(ctx, "owner");
  const label = input.label.trim();
  if (label.length < 2) throw new Error("LABEL_TOO_SHORT");
  if (label.length > 50) throw new Error("LABEL_TOO_LONG");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("stable_session_types")
    .insert({
      stable_id:  ctx.stableId,
      label,
      color:      input.color ?? null,
      sort_order: input.sort_order ?? 0,
      active:     true,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id };
}

export async function updateStableSessionType(
  id: string,
  patch: Partial<Pick<StableSessionType, "label" | "color" | "sort_order" | "active">>,
): Promise<void> {
  const ctx = await getSession();
  requireRole(ctx, "owner");
  const update: Record<string, unknown> = {};
  if (patch.label      !== undefined) update.label      = patch.label.trim();
  if (patch.color      !== undefined) update.color      = patch.color;
  if (patch.sort_order !== undefined) update.sort_order = patch.sort_order;
  if (patch.active     !== undefined) update.active     = patch.active;
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("stable_session_types")
    .update(update)
    .eq("id", id)
    .eq("stable_id", ctx.stableId);
  if (error) throw error;
}

export async function deleteStableSessionType(id: string): Promise<void> {
  const ctx = await getSession();
  requireRole(ctx, "owner");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("stable_session_types")
    .delete()
    .eq("id", id)
    .eq("stable_id", ctx.stableId);
  if (error) throw error;
}
