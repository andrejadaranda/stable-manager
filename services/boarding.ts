// Horse boarding service.
//
// Boarding charges are recurring (typically monthly) billing rows for
// keeping a horse at the stable — feed, stall, hay, basic care.
// horses.owner_client_id (set in 15_horse_owner.sql) tells us who's on
// the hook for boarding payments.
//
// The data model lives in 21_horse_boarding.sql. The view
// `horse_boarding_summary` pre-aggregates `paid_amount` and a
// `payment_status` label ('paid' | 'partial' | 'unpaid') per charge.
//
// RLS:
//   * read   : staff for the whole stable; client for charges on
//              horses they own.
//   * write  : OWNER only.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getSession,
  requireRole,
  requireOwnerOrClientSelf,
} from "@/lib/auth/session";

// ---------- types -------------------------------------------------

export type BoardingChargeRow = {
  id: string;
  stable_id: string;
  horse_id: string;
  owner_client_id: string;
  period_start: string;
  period_end: string;
  period_label: string | null;
  amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** Computed in the `horse_boarding_summary` view. */
  paid_amount: number;
  /** Computed in the view: 'paid' | 'partial' | 'unpaid'. */
  payment_status: "paid" | "partial" | "unpaid";
};

export type CreateChargeInput = {
  horseId: string;
  /** ISO date string (YYYY-MM-DD). */
  periodStart: string;
  /** ISO date string (YYYY-MM-DD). Inclusive. */
  periodEnd: string;
  /** Free-form label like "April 2026". Optional. */
  periodLabel?: string | null;
  amount: number;
  notes?: string | null;
};

// ---------- writes (owner only) -----------------------------------

/** Set the default monthly boarding fee on a horse. Pass `null` to
 *  clear it (e.g. the stable now owns the horse). */
export async function setHorseMonthlyBoardingFee(
  horseId: string,
  fee: number | null,
): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner");
  if (fee !== null && (!Number.isFinite(fee) || fee < 0)) {
    throw new Error("INVALID_AMOUNT");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("horses")
    .update({ monthly_boarding_fee: fee })
    .eq("id", horseId);
  if (error) throw error;
}

/** Create one charge. The owner client is read off the horse so the
 *  caller doesn't need to know it; if the horse has no owner_client_id
 *  the call fails with HORSE_HAS_NO_OWNER (configure the horse first). */
export async function createCharge(
  input: CreateChargeInput,
): Promise<BoardingChargeRow> {
  const session = await getSession();
  requireRole(session, "owner");
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new Error("INVALID_AMOUNT");
  }

  const supabase = createSupabaseServerClient();
  const { data: horse, error: hErr } = await supabase
    .from("horses")
    .select("id, owner_client_id, stable_id")
    .eq("id", input.horseId)
    .maybeSingle();
  if (hErr) throw hErr;
  if (!horse) throw new Error("HORSE_NOT_FOUND");
  const h = horse as { id: string; owner_client_id: string | null; stable_id: string };
  if (!h.owner_client_id) throw new Error("HORSE_HAS_NO_OWNER");

  const { data, error } = await supabase
    .from("horse_boarding_charges")
    .insert({
      stable_id:       session.stableId,
      horse_id:        input.horseId,
      owner_client_id: h.owner_client_id,
      period_start:    input.periodStart,
      period_end:      input.periodEnd,
      period_label:    input.periodLabel ?? null,
      amount:          input.amount,
      notes:           input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  // Refetch via the summary view so the caller gets paid_amount + status
  // (always 0 / unpaid for a freshly created charge).
  const { data: summary, error: vErr } = await supabase
    .from("horse_boarding_summary")
    .select("*")
    .eq("id", (data as { id: string }).id)
    .single();
  if (vErr) throw vErr;
  return summary as BoardingChargeRow;
}

export async function deleteCharge(chargeId: string): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("horse_boarding_charges")
    .delete()
    .eq("id", chargeId);
  if (error) throw error;
}

/** One-click "Mark paid". Creates a payments row at the charge amount,
 *  linked via `boarding_charge_id` so revenue/balance reflect it. */
export async function markChargePaid(
  chargeId: string,
  method: "cash" | "card" | "transfer" | "other" = "cash",
): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner");

  const supabase = createSupabaseServerClient();
  const { data: charge, error } = await supabase
    .from("horse_boarding_summary")
    .select("id, amount, paid_amount, owner_client_id")
    .eq("id", chargeId)
    .maybeSingle();
  if (error) throw error;
  if (!charge) throw new Error("CHARGE_NOT_FOUND");
  const c = charge as {
    id: string; amount: number; paid_amount: number; owner_client_id: string;
  };
  const remaining = Number(c.amount) - Number(c.paid_amount);
  if (remaining <= 0) return; // already settled

  // Direct insert — payments service doesn't expose boarding_charge_id
  // yet, but the same RLS + same-stable trigger applies. The trigger
  // verifies the charge belongs to this stable + client.
  const { error: pErr } = await supabase
    .from("payments")
    .insert({
      stable_id:           session.stableId,
      client_id:           c.owner_client_id,
      lesson_id:           null,
      package_id:          null,
      boarding_charge_id:  c.id,
      amount:              remaining,
      method,
      paid_at:             new Date().toISOString(),
      notes:               "Boarding payment",
    });
  if (pErr) throw pErr;
}

/** Undo the paid mark by deleting payments tied to the charge. */
export async function markChargeUnpaid(chargeId: string): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("payments")
    .delete()
    .eq("boarding_charge_id", chargeId);
  if (error) throw error;
}

// ---------- reads -------------------------------------------------

export async function listChargesForHorse(
  horseId: string,
): Promise<BoardingChargeRow[]> {
  const session = await getSession();
  // Staff see all; client sees only their own (via RLS on the view).
  // We don't enforce extra here — RLS narrows automatically.
  void session;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("horse_boarding_summary")
    .select("*")
    .eq("horse_id", horseId)
    .order("period_start", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BoardingChargeRow[];
}

export async function listChargesForClient(
  clientId: string,
): Promise<BoardingChargeRow[]> {
  const session = await getSession();
  requireOwnerOrClientSelf(session, clientId);
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("horse_boarding_summary")
    .select("*")
    .eq("owner_client_id", clientId)
    .order("period_start", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BoardingChargeRow[];
}
