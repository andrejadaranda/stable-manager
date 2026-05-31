// Boarding rate presets — per-stable named monthly prices.
//
// A stable can offer several boarding tiers (e.g. "Full board €350",
// "Part board €220", "Pasture €150"). These presets pre-fill the
// per-horse monthly fee + boarding charges so the owner doesn't retype
// amounts. Data model: migration boarding_rate_presets.
//
// RLS:
//   * read  : any stable member
//   * write : OWNER only

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";

export type BoardingRateRow = {
  id: string;
  stable_id: string;
  name: string;
  amount: number;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export async function listBoardingRates(opts?: { activeOnly?: boolean }): Promise<BoardingRateRow[]> {
  const session = await getSession();
  void session;
  const supabase = createSupabaseServerClient();
  let q = supabase
    .from("boarding_rates")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (opts?.activeOnly) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as BoardingRateRow[];
}

export async function createBoardingRate(input: {
  name: string;
  amount: number;
  sortOrder?: number;
}): Promise<BoardingRateRow> {
  const session = await getSession();
  requireRole(session, "owner");
  const name = input.name.trim();
  if (!name) throw new Error("RATE_NAME_REQUIRED");
  if (name.length > 80) throw new Error("RATE_NAME_TOO_LONG");
  if (!Number.isFinite(input.amount) || input.amount < 0) throw new Error("INVALID_AMOUNT");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("boarding_rates")
    .insert({
      stable_id:  session.stableId,
      name,
      amount:     input.amount,
      sort_order: input.sortOrder ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data as BoardingRateRow;
}

export async function updateBoardingRate(
  id: string,
  input: { name?: string; amount?: number; active?: boolean; sortOrder?: number },
): Promise<BoardingRateRow> {
  const session = await getSession();
  requireRole(session, "owner");
  const update: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const n = input.name.trim();
    if (!n) throw new Error("RATE_NAME_REQUIRED");
    update.name = n;
  }
  if (input.amount !== undefined) {
    if (!Number.isFinite(input.amount) || input.amount < 0) throw new Error("INVALID_AMOUNT");
    update.amount = input.amount;
  }
  if (input.active !== undefined) update.active = input.active;
  if (input.sortOrder !== undefined) update.sort_order = input.sortOrder;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("boarding_rates")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as BoardingRateRow;
}

export async function deleteBoardingRate(id: string): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("boarding_rates").delete().eq("id", id);
  if (error) throw error;
}
