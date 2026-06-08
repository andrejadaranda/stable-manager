// Farrier visits — schedulable calendar appointments with multiple horses.
// Table + RLS in migration 66_farrier_visits.sql. RLS exposes a visit to a
// horse-owner client when one of the attached horses is theirs, so the same
// list query powers both the stable calendar and the owner's /my-lessons.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";
import { markClientChargePaid, markClientChargeUnpaid } from "./clientCharges";
import type {
  CalendarFarrierVisit,
  CareVisitKind,
  FarrierHorseInput,
  HorseCareVisit,
} from "./farrierVisits.pure";

export type {
  CalendarFarrierVisit,
  CareVisitKind,
  FarrierVisitHorse,
  FarrierHorseInput,
  HorseCareVisit,
} from "./farrierVisits.pure";

/**
 * Farrier visits overlapping the [from, to) window, with attached horses.
 * Works for staff and owner-clients alike — RLS narrows the rows.
 */
export async function getFarrierVisitsForCalendar(
  from: string,
  to: string,
): Promise<CalendarFarrierVisit[]> {
  await getSession();
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("farrier_visits")
    .select(
      `
      id, kind, starts_at, ends_at, farrier_name, notes, status, expense_cents,
      farrier_visit_horses (
        cost_cents, note, paid_at,
        horse:horses!farrier_visit_horses_horse_id_fkey ( id, name )
      )
      `,
    )
    .gte("starts_at", from)
    .lt("starts_at", to)
    .order("starts_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((v: any): CalendarFarrierVisit => ({
    id: v.id,
    event_type: "farrier_visit",
    kind: v.kind === "vet" ? "vet" : "farrier",
    starts_at: v.starts_at,
    ends_at: v.ends_at,
    farrier_name: v.farrier_name ?? null,
    notes: v.notes ?? null,
    status: v.status,
    expense_cents: v.expense_cents ?? null,
    horses: (v.farrier_visit_horses ?? [])
      .filter((r: any) => r.horse)
      .map((r: any) => ({
        id: r.horse.id,
        name: r.horse.name,
        cost_cents: r.cost_cents ?? null,
        note: r.note ?? null,
        paid_at: r.paid_at ?? null,
      })),
  }));
}

// Create or update the linked stable expense for a visit. Owner-only
// (expenses RLS), so employees creating a visit simply skip the expense.
// Returns the expense id to store on the visit (or null).
async function syncVisitExpense(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  args: {
    role: string;
    stableId: string;
    userId: string;
    existingExpenseId: string | null;
    expenseCents: number | null;
    kind: CareVisitKind;
    farrierName: string | null;
    startsISO: string;
  },
): Promise<string | null> {
  if (args.role !== "owner") return args.existingExpenseId;
  const cents = args.expenseCents;
  const incurredOn = args.startsISO.slice(0, 10);
  const label = args.kind === "vet" ? "Vet visit" : "Farrier visit";
  const description = args.farrierName ? `${label} — ${args.farrierName}` : label;

  // No amount → remove any previously linked expense.
  if (!cents || cents <= 0) {
    if (args.existingExpenseId) {
      await supabase.from("expenses").delete().eq("id", args.existingExpenseId);
    }
    return null;
  }

  const payload = {
    category: args.kind, // 'farrier' | 'vet' — both valid ExpenseCategory
    amount: cents / 100,
    description,
    incurred_on: incurredOn,
  };

  if (args.existingExpenseId) {
    const { error } = await supabase.from("expenses").update(payload).eq("id", args.existingExpenseId);
    if (error) throw error;
    return args.existingExpenseId;
  }
  const { data, error } = await supabase
    .from("expenses")
    .insert({ ...payload, stable_id: args.stableId, horse_id: null, created_by: args.userId })
    .select("id")
    .single();
  if (error) throw error;
  return (data as any).id as string;
}

// Sync the owner-facing per-horse cost into the client-charge ledger (the
// single source of truth for what the owner owes). Returns the linked
// charge id to store on the junction row (or null when there's no owner /
// no cost). Billed to the horse's owner_client_id.
async function upsertHorseCharge(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  opts: {
    stableId: string;
    horseId: string;
    kind: CareVisitKind;
    costCents: number | null;
    note: string | null;
    startsISO: string;
    existingChargeId: string | null;
  },
): Promise<string | null> {
  const { data: horse } = await supabase
    .from("horses")
    .select("owner_client_id")
    .eq("id", opts.horseId)
    .maybeSingle();
  const ownerId = (horse as any)?.owner_client_id ?? null;
  const cents = opts.costCents;

  // No owner (stable-owned horse) or no cost → remove any existing charge.
  if (!ownerId || !cents || cents <= 0) {
    if (opts.existingChargeId) {
      await supabase.from("client_charges").delete().eq("id", opts.existingChargeId);
    }
    return null;
  }

  const chargeKind = opts.kind === "vet" ? "vet_copay" : "farrier";
  // It's a reimbursement of what the stable paid the farrier/vet on the
  // owner's behalf — not a sold service. The label makes that explicit on
  // the invoice. (Date comes from incurred_on.)
  const label = `${opts.kind === "vet" ? "Vet" : "Farrier"} reimbursement`;
  const payload = {
    client_id:    ownerId,
    horse_id:     opts.horseId,
    kind:         chargeKind,
    custom_label: label,
    amount:       cents / 100,
    incurred_on:  opts.startsISO.slice(0, 10),
    notes:        opts.note,
  };

  if (opts.existingChargeId) {
    await supabase.from("client_charges").update(payload).eq("id", opts.existingChargeId);
    return opts.existingChargeId;
  }
  const { data, error } = await supabase
    .from("client_charges")
    .insert({ ...payload, stable_id: opts.stableId })
    .select("id")
    .single();
  if (error) throw error;
  return (data as any).id as string;
}

function dedupeHorses(horses: FarrierHorseInput[]): FarrierHorseInput[] {
  const seen = new Set<string>();
  const out: FarrierHorseInput[] = [];
  for (const h of horses) {
    if (!h.horse_id || seen.has(h.horse_id)) continue;
    seen.add(h.horse_id);
    out.push(h);
  }
  return out;
}

/** Create a farrier/vet visit and attach horses (each with optional
 *  cost + note). Staff only. */
export async function createFarrierVisit(input: {
  starts_at: string;
  ends_at: string;
  kind?: CareVisitKind;
  farrier_name?: string | null;
  notes?: string | null;
  expense_cents?: number | null;
  horses: FarrierHorseInput[];
}): Promise<{ id: string }> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  const supabase = createSupabaseServerClient();
  const kind = input.kind === "vet" ? "vet" : "farrier";
  const farrierName = input.farrier_name?.trim() || null;

  const { data, error } = await supabase
    .from("farrier_visits")
    .insert({
      stable_id: session.stableId,
      kind,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      farrier_name: farrierName,
      notes: input.notes?.trim() || null,
      created_by: session.userId,
    })
    .select("id")
    .single();
  if (error) throw error;

  const visitId = (data as any).id as string;
  const horses = dedupeHorses(input.horses);
  if (horses.length > 0) {
    const rows = [];
    for (const h of horses) {
      const note = h.note?.toString().trim() || null;
      const chargeId = await upsertHorseCharge(supabase, {
        stableId: session.stableId,
        horseId: h.horse_id,
        kind,
        costCents: h.cost_cents ?? null,
        note,
        startsISO: input.starts_at,
        existingChargeId: null,
      });
      rows.push({
        visit_id: visitId,
        horse_id: h.horse_id,
        cost_cents: h.cost_cents ?? null,
        note,
        client_charge_id: chargeId,
      });
    }
    const { error: jerr } = await supabase.from("farrier_visit_horses").insert(rows);
    if (jerr) throw jerr;
  }

  // Money out: what the stable pays the farrier = the total of every
  // horse's cost (the owner isn't usually there, so the stable pays the
  // whole bill). Client-owned horses are reimbursed via their charge;
  // the stable's own horses are a pure expense. Manual "Paid to farrier"
  // overrides (e.g. a call-out fee on top).
  const horseCostSum = horses.reduce((s, h) => s + (h.cost_cents ?? 0), 0);
  const effectiveExpense =
    input.expense_cents && input.expense_cents > 0 ? input.expense_cents : horseCostSum > 0 ? horseCostSum : null;

  const expenseId = await syncVisitExpense(supabase, {
    role: session.role,
    stableId: session.stableId,
    userId: session.userId,
    existingExpenseId: null,
    expenseCents: effectiveExpense,
    kind,
    farrierName,
    startsISO: input.starts_at,
  });
  await supabase.from("farrier_visits").update({ expense_cents: effectiveExpense, expense_id: expenseId }).eq("id", visitId);
  return { id: visitId };
}

/** Edit a visit and replace its horse list (preserving paid_at for horses
 *  that stay attached). Staff only. */
export async function updateFarrierVisit(
  id: string,
  input: {
    starts_at: string;
    ends_at: string;
    kind?: CareVisitKind;
    farrier_name?: string | null;
    notes?: string | null;
    expense_cents?: number | null;
    horses: FarrierHorseInput[];
  },
): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  const supabase = createSupabaseServerClient();
  const kind = input.kind === "vet" ? "vet" : "farrier";
  const farrierName = input.farrier_name?.trim() || null;

  const { data: prior } = await supabase
    .from("farrier_visits")
    .select("expense_id")
    .eq("id", id)
    .maybeSingle();
  const existingExpenseId = (prior as any)?.expense_id ?? null;

  const { error: uerr } = await supabase
    .from("farrier_visits")
    .update({
      kind,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      farrier_name: farrierName,
      notes: input.notes?.trim() || null,
    })
    .eq("id", id);
  if (uerr) throw uerr;

  // Money out = total of all horse costs (manual "Paid to farrier" wins).
  const horseCostSumU = dedupeHorses(input.horses).reduce((s, h) => s + (h.cost_cents ?? 0), 0);
  const effectiveExpenseU =
    input.expense_cents && input.expense_cents > 0 ? input.expense_cents : horseCostSumU > 0 ? horseCostSumU : null;

  const expenseId = await syncVisitExpense(supabase, {
    role: session.role,
    stableId: session.stableId,
    userId: session.userId,
    existingExpenseId,
    expenseCents: effectiveExpenseU,
    kind,
    farrierName,
    startsISO: input.starts_at,
  });
  await supabase
    .from("farrier_visits")
    .update({ expense_cents: effectiveExpenseU, expense_id: expenseId })
    .eq("id", id);

  // Preserve paid_at + the linked charge across the rebuild.
  const { data: existing } = await supabase
    .from("farrier_visit_horses")
    .select("horse_id, paid_at, client_charge_id")
    .eq("visit_id", id);
  const priorByHorse = new Map<string, { paid_at: string | null; charge_id: string | null }>(
    (existing ?? []).map((r: any) => [r.horse_id, { paid_at: r.paid_at ?? null, charge_id: r.client_charge_id ?? null }]),
  );

  const { error: derr } = await supabase
    .from("farrier_visit_horses")
    .delete()
    .eq("visit_id", id);
  if (derr) throw derr;

  const horses = dedupeHorses(input.horses);
  const keep = new Set(horses.map((h) => h.horse_id));
  // Drop charges for horses removed from this visit.
  for (const [hid, prior] of priorByHorse.entries()) {
    if (!keep.has(hid) && prior.charge_id) {
      await supabase.from("client_charges").delete().eq("id", prior.charge_id);
    }
  }

  if (horses.length > 0) {
    const rows = [];
    for (const h of horses) {
      const note = h.note?.toString().trim() || null;
      const prior = priorByHorse.get(h.horse_id);
      const chargeId = await upsertHorseCharge(supabase, {
        stableId: session.stableId,
        horseId: h.horse_id,
        kind,
        costCents: h.cost_cents ?? null,
        note,
        startsISO: input.starts_at,
        existingChargeId: prior?.charge_id ?? null,
      });
      rows.push({
        visit_id: id,
        horse_id: h.horse_id,
        cost_cents: h.cost_cents ?? null,
        note,
        paid_at: prior?.paid_at ?? null,
        client_charge_id: chargeId,
      });
    }
    const { error: ierr } = await supabase.from("farrier_visit_horses").insert(rows);
    if (ierr) throw ierr;
  }
}

/** Mark one horse's care cost paid/unpaid. Routes through the linked
 *  client charge, so paying creates a real payment (moving Collected /
 *  dashboard) and the owner's "Other charges" ledger stays in sync. */
export async function setFarrierHorsePaid(
  visitId: string,
  horseId: string,
  paid: boolean,
): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  const supabase = createSupabaseServerClient();

  const { data: row } = await supabase
    .from("farrier_visit_horses")
    .select("client_charge_id")
    .eq("visit_id", visitId)
    .eq("horse_id", horseId)
    .maybeSingle();
  const chargeId = (row as any)?.client_charge_id ?? null;
  if (!chargeId) return; // no cost recorded → nothing to settle

  if (paid) await markClientChargePaid(chargeId);
  else await markClientChargeUnpaid(chargeId);

  // Keep the junction's display flag in step with the charge.
  await supabase
    .from("farrier_visit_horses")
    .update({ paid_at: paid ? new Date().toISOString() : null })
    .eq("visit_id", visitId)
    .eq("horse_id", horseId);
}

/** Care visits for a single horse — for the horse dashboard. RLS lets
 *  staff (any stable horse) and the horse-owner (their horse) read. */
export async function getCareVisitsForHorse(
  horseId: string,
): Promise<HorseCareVisit[]> {
  await getSession();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("farrier_visit_horses")
    .select(
      `
      cost_cents, note, paid_at, client_charge_id,
      visit:farrier_visits!farrier_visit_horses_visit_id_fkey (
        id, kind, starts_at, farrier_name
      )
      `,
    )
    .eq("horse_id", horseId);
  if (error) throw error;

  // Paid status is canonical on the linked charge — fetch it so the card
  // reflects payments made anywhere (farrier section or Other charges).
  const chargeIds = (data ?? [])
    .map((r: any) => r.client_charge_id)
    .filter((x: any): x is string => Boolean(x));
  const paidCharges = new Set<string>();
  if (chargeIds.length) {
    const { data: charges } = await supabase
      .from("client_charge_summary")
      .select("id, payment_status")
      .in("id", chargeIds);
    for (const c of (charges ?? []) as Array<{ id: string; payment_status: string }>) {
      if (c.payment_status === "paid") paidCharges.add(c.id);
    }
  }

  return (data ?? [])
    .filter((r: any) => r.visit)
    .map((r: any): HorseCareVisit => {
      const charged = Boolean(r.client_charge_id);
      const paid = charged ? paidCharges.has(r.client_charge_id) : Boolean(r.paid_at);
      return {
        id: r.visit.id,
        kind: r.visit.kind === "vet" ? "vet" : "farrier",
        starts_at: r.visit.starts_at,
        farrier_name: r.visit.farrier_name ?? null,
        cost_cents: r.cost_cents ?? null,
        note: r.note ?? null,
        paid_at: paid ? (r.paid_at ?? r.visit.starts_at) : null,
      };
    })
    .sort((a: HorseCareVisit, b: HorseCareVisit) => b.starts_at.localeCompare(a.starts_at));
}

/** Delete a farrier visit (junction rows cascade). Staff only. */
export async function deleteFarrierVisit(id: string): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("farrier_visits").delete().eq("id", id);
  if (error) throw error;
}
