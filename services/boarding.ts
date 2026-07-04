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

/** Set (or clear) the boarding start date on a horse. Owner-only. */
export async function setHorseBoardingStartDate(
  horseId: string,
  startDate: string | null,
): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("horses")
    .update({ boarding_start_date: startDate })
    .eq("id", horseId);
  if (error) throw error;
}

/** Mark WHEN a horse left the stable (or clear it, pass null). Once set,
 *  boarding charges stop being generated for months AFTER this date — the
 *  departure month is still billed, later months are not. The horse keeps
 *  its profile + history (unlike setting active = false). Owner-only. */
export async function setHorseBoardingEndDate(
  horseId: string,
  endDate: string | null,
): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner");
  void session;
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("horses")
    .update({ boarding_end_date: endDate })
    .eq("id", horseId);
  if (error) throw error;
}

/** Auto-create one boarding charge per calendar month from the horse's
 *  boarding_start_date up to (and including) the current month — skipping
 *  any month that already has a charge. Each uses the horse's monthly fee.
 *  Lets the owner track paid/unpaid per month without typing each one.
 *  Returns how many charges were created. Owner-only. */
export async function generateMissingBoardingMonths(
  horseId: string,
): Promise<{ created: number }> {
  const session = await getSession();
  requireRole(session, "owner");
  const supabase = createSupabaseServerClient();

  const { data: horse, error: hErr } = await supabase
    .from("horses")
    .select("id, owner_client_id, boarding_start_date, boarding_end_date, monthly_boarding_fee")
    .eq("id", horseId)
    .maybeSingle();
  if (hErr) throw hErr;
  if (!horse) throw new Error("HORSE_NOT_FOUND");
  const h = horse as {
    owner_client_id: string | null;
    boarding_start_date: string | null;
    boarding_end_date: string | null;
    monthly_boarding_fee: number | null;
  };
  if (!h.owner_client_id) throw new Error("HORSE_HAS_NO_OWNER");
  if (!h.boarding_start_date) throw new Error("NO_BOARDING_START_DATE");
  if (h.monthly_boarding_fee == null) throw new Error("NO_MONTHLY_FEE");

  // Existing charge months for this horse (by period_start YYYY-MM).
  const { data: existing, error: eErr } = await supabase
    .from("horse_boarding_charges")
    .select("period_start")
    .eq("horse_id", horseId);
  if (eErr) throw eErr;
  const have = new Set(
    ((existing ?? []) as { period_start: string }[]).map((r) => r.period_start.slice(0, 7)),
  );

  // Walk months from start → current, but never past the departure month
  // (boarding_end_date). The month the horse left is still billed; later
  // months are skipped entirely.
  const start = new Date(h.boarding_start_date);
  const now = new Date();
  const records: Array<Record<string, unknown>> = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  let last = new Date(now.getFullYear(), now.getMonth(), 1);
  if (h.boarding_end_date) {
    const end = new Date(h.boarding_end_date);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    if (endMonth < last) last = endMonth;
  }
  while (cursor <= last) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth(); // 0-based
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    if (!have.has(key)) {
      const periodStart = `${key}-01`;
      const lastDay = new Date(y, m + 1, 0).getDate();
      const periodEnd = `${key}-${String(lastDay).padStart(2, "0")}`;
      const label = new Date(y, m, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
      records.push({
        stable_id:       session.stableId,
        horse_id:        horseId,
        owner_client_id: h.owner_client_id,
        period_start:    periodStart,
        period_end:      periodEnd,
        period_label:    label,
        amount:          h.monthly_boarding_fee,
        notes:           null,
      });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  if (records.length === 0) return { created: 0 };
  const { error: insErr } = await supabase.from("horse_boarding_charges").insert(records);
  if (insErr) throw insErr;
  return { created: records.length };
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
  /** Optional partial amount. Omit (or pass >= remaining) to settle in
   *  full; a smaller value records a partial boarding payment. */
  amount?: number,
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

  const pay = amount != null && amount > 0 ? Math.min(amount, remaining) : remaining;
  if (pay <= 0) return;

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
      amount:              pay,
      method,
      paid_at:             new Date().toISOString(),
      notes:               pay < remaining ? "Boarding — partial payment" : "Boarding payment",
    });
  if (pErr) throw pErr;
}

/** Stable-wide list of OUTSTANDING boarding charges across every
 *  boarder. Drives the Settings → Boarding "Outstanding" board where
 *  the owner sees who hasn't paid in one place and one-clicks to
 *  mark paid (with confirm dialog so misclicks don't go through). */
export type OutstandingBoardingRow = {
  id:                 string;
  horse_id:           string;
  horse_name:         string;
  owner_client_id:    string;
  owner_client_name:  string;
  period_label:       string | null;
  period_start:       string;
  amount:             number;
  paid_amount:        number;
  payment_status:     "paid" | "partial" | "unpaid";
};

export async function listOutstandingBoardingCharges(): Promise<OutstandingBoardingRow[]> {
  const session = await getSession();
  requireRole(session, "owner");
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("horse_boarding_summary")
    .select(`
      id, period_label, period_start, amount, paid_amount, payment_status,
      horse_id, owner_client_id,
      horse:horses(name),
      owner:clients!horse_boarding_charges_owner_client_id_fkey(full_name)
    `)
    .neq("payment_status", "paid")
    .order("period_start", { ascending: false });
  if (error) throw error;
  type Row = {
    id: string;
    period_label: string | null;
    period_start: string;
    amount: number;
    paid_amount: number;
    payment_status: "paid" | "partial" | "unpaid";
    horse_id: string;
    owner_client_id: string;
    horse:  { name: string } | { name: string }[] | null;
    owner:  { full_name: string } | { full_name: string }[] | null;
  };
  function pickOne<T>(rel: T | T[] | null): T | null {
    if (!rel) return null;
    return Array.isArray(rel) ? (rel[0] ?? null) : rel;
  }
  return ((data ?? []) as Row[]).map((r) => {
    const h = pickOne(r.horse);
    const o = pickOne(r.owner);
    return {
      id:                r.id,
      horse_id:          r.horse_id,
      horse_name:        h?.name ?? "—",
      owner_client_id:   r.owner_client_id,
      owner_client_name: o?.full_name ?? "—",
      period_label:      r.period_label,
      period_start:      r.period_start,
      amount:            Number(r.amount),
      paid_amount:       Number(r.paid_amount),
      payment_status:    r.payment_status,
    };
  });
}

/** Remaining (unpaid) amount on a single boarding charge. Owner-only.
 *  Returns null if the charge isn't visible to this stable (RLS) or gone.
 *  Used to validate manual boarding payments don't overpay a month. */
export async function getBoardingChargeRemaining(chargeId: string): Promise<number | null> {
  const session = await getSession();
  requireRole(session, "owner");
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("horse_boarding_summary")
    .select("amount, paid_amount")
    .eq("id", chargeId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as { amount: number; paid_amount: number };
  return Math.max(0, Number(row.amount) - Number(row.paid_amount));
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

/** A boarding charge plus the horse's name — needed wherever a client
 *  who boards more than one horse needs to tell the months apart. */
export type BoardingChargeWithHorse = BoardingChargeRow & { horse_name: string | null };

export async function listChargesForClient(
  clientId: string,
): Promise<BoardingChargeWithHorse[]> {
  const session = await getSession();
  requireOwnerOrClientSelf(session, clientId);
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("horse_boarding_summary")
    .select("*")
    .eq("owner_client_id", clientId)
    .order("period_start", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as BoardingChargeRow[];

  // The view exposes horse_id only, so resolve names in one keyed query.
  // RLS lets the client read the horses they own (and staff read all).
  const ids = Array.from(new Set(rows.map((r) => r.horse_id)));
  const nameById = new Map<string, string>();
  if (ids.length > 0) {
    const { data: horses } = await supabase
      .from("horses")
      .select("id, name")
      .in("id", ids);
    for (const h of (horses ?? []) as { id: string; name: string }[]) {
      nameById.set(h.id, h.name);
    }
  }
  return rows.map((r) => ({ ...r, horse_name: nameById.get(r.horse_id) ?? null }));
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

  // All horses with a boarding fee set + an owner client — excluding any
  // that left the stable before this month starts. A horse that departed
  // during (or after) the target month is still billed for it; one that
  // left in an earlier month is dropped. `boarding_end_date >= periodStart`
  // OR it's null (still boarding).
  // NB: we deliberately do NOT filter on `active`. A horse can be retired
  // from the lesson rotation (active = false) yet still board and owe the
  // monthly fee — private boarders are the common case. Boarding stops only
  // when a departure date (boarding_end_date) is set. So the boarding
  // universe = any horse with a fee + owner that hasn't left before this
  // month.
  const { data: horses, error: hErr } = await supabase
    .from("horses")
    .select(
      `id, name, owner_client_id, monthly_boarding_fee, boarding_end_date,
       owner_client:clients!horses_owner_client_id_fkey(id, full_name)`,
    )
    .not("monthly_boarding_fee", "is", null)
    .not("owner_client_id", "is", null)
    .or(`boarding_end_date.is.null,boarding_end_date.gte.${periodStart}`);
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
