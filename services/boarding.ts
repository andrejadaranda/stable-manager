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

// =================================================================
// Bulk generation
// =================================================================

export type BoardingPreviewRow = {
  horseId: string;
  horseName: string;
  ownerClientId: string;
  ownerClientName: string;
  fee: number;
  /** True when a charge already exists for this horse in that period
   *  — the bulk insert will skip it. */
  alreadyHasCharge: boolean;
};

export type BoardingPreview = {
  /** YYYY-MM-01 — first day of the target month. */
  periodStart: string;
  /** YYYY-MM-LAST — last day of the target month. */
  periodEnd: string;
  /** Friendly label e.g. "April 2026". */
  label: string;
  rows: BoardingPreviewRow[];
};

/** Returns the dry-run preview for "generate boarding charges for the
 *  given month": which horses qualify, which already have a charge,
 *  the total amount that would be billed.
 */
export async function previewBoardingForMonth(
  yearMonth: string, // YYYY-MM
): Promise<BoardingPreview> {
  const session = await getSession();
  requireRole(session, "owner");

  const { periodStart, periodEnd, label } = monthBounds(yearMonth);

  const supabase = createSupabaseServerClient();

  // All horses with a boarding fee set + an owner client.
  const { data: horses, error: hErr } = await supabase
    .from("horses")
    .select(
      `id, name, owner_client_id, monthly_boarding_fee,
       owner_client:clients!horses_owner_client_id_fkey(id, full_name)`,
    )
    .eq("active", true)
    .not("monthly_boarding_fee", "is", null)
    .not("owner_client_id", "is", null);
  if (hErr) throw hErr;

  // Existing charges that overlap this month — used to flag duplicates.
  const { data: existing, error: eErr } = await supabase
    .from("horse_boarding_charges")
    .select("horse_id")
    .gte("period_start", periodStart)
    .lte("period_start", periodEnd);
  if (eErr) throw eErr;
  const existingByHorse = new Set(
    ((existing ?? []) as { horse_id: string }[]).map((r) => r.horse_id),
  );

  type HorseRow = {
    id: string;
    name: string;
    owner_client_id: string;
    monthly_boarding_fee: number;
    owner_client: { id: string; full_name: string } | null;
  };
  const rows: BoardingPreviewRow[] = ((horses ?? []) as unknown as HorseRow[]).map((h) => ({
    horseId:         h.id,
    horseName:       h.name,
    ownerClientId:   h.owner_client_id,
    ownerClientName: h.owner_client?.full_name ?? "—",
    fee:             Number(h.monthly_boarding_fee),
    alreadyHasCharge: existingByHorse.has(h.id),
  }));

  return { periodStart, periodEnd, label, rows };
}

/** Bulk-create boarding charges for the given month.
 *  Skips horses that already have a charge starting in that month.
 *  Returns the count of charges actually inserted.
 */
export async function generateBoardingForMonth(
  yearMonth: string, // YYYY-MM
): Promise<{ created: number; skipped: number; totalAmount: number }> {
  const session = await getSession();
  requireRole(session, "owner");

  const preview = await previewBoardingForMonth(yearMonth);
  const toInsert = preview.rows.filter((r) => !r.alreadyHasCharge);
  if (toInsert.length === 0) {
    return {
      created: 0,
      skipped: preview.rows.length,
      totalAmount: 0,
    };
  }

  const supabase = createSupabaseServerClient();
  const records = toInsert.map((r) => ({
    stable_id:       session.stableId,
    horse_id:        r.horseId,
    owner_client_id: r.ownerClientId,
    period_start:    preview.periodStart,
    period_end:      preview.periodEnd,
    period_label:    preview.label,
    amount:          r.fee,
    notes:           null,
  }));

  const { error } = await supabase.from("horse_boarding_charges").insert(records);
  if (error) throw error;

  const totalAmount = toInsert.reduce((acc, r) => acc + r.fee, 0);
  return {
    created: toInsert.length,
    skipped: preview.rows.length - toInsert.length,
    totalAmount,
  };
}

// ---------- helpers -----------------------------------------------

function monthBounds(yearMonth: string): {
  periodStart: string;
  periodEnd: string;
  label: string;
} {
  // yearMonth: "YYYY-MM"
  const m = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!m) throw new Error("INVALID_PERIOD");
  const year  = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) throw new Error("INVALID_PERIOD");

  // Last day of the month: day 0 of the next month.
  const lastDay = new Date(year, month, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  const periodStart = `${year}-${pad(month)}-01`;
  const periodEnd   = `${year}-${pad(month)}-${pad(lastDay)}`;

  const label = new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year:  "numeric",
  });

  return { periodStart, periodEnd, label };
}
