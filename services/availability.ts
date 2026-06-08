// Block-out times — when the stable/trainer can't take lessons. Shown red
// on the calendar (month + week) so nothing is booked into them.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";
import type { AvailabilityBlock } from "./availability.pure";

export type { AvailabilityBlock } from "./availability.pure";

/** Blocks overlapping [from, to). */
export async function listAvailabilityBlocks(from: string, to: string): Promise<AvailabilityBlock[]> {
  await getSession();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("availability_blocks")
    .select("id, starts_at, ends_at, all_day, reason")
    .lt("starts_at", to)
    .gt("ends_at", from)
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AvailabilityBlock[];
}

export async function createAvailabilityBlock(input: {
  starts_at: string;
  ends_at: string;
  all_day?: boolean;
  reason?: string | null;
}): Promise<{ id: string }> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  if (new Date(input.ends_at) <= new Date(input.starts_at)) throw new Error("INVALID_TIME_RANGE");
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("availability_blocks")
    .insert({
      stable_id:  session.stableId,
      starts_at:  input.starts_at,
      ends_at:    input.ends_at,
      all_day:    input.all_day ?? false,
      reason:     input.reason?.trim() || null,
      created_by: session.userId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: (data as { id: string }).id };
}

export async function deleteAvailabilityBlock(id: string): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("availability_blocks").delete().eq("id", id);
  if (error) throw error;
}
