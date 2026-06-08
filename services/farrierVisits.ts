// Farrier visits — schedulable calendar appointments with multiple horses.
// Table + RLS in migration 66_farrier_visits.sql. RLS exposes a visit to a
// horse-owner client when one of the attached horses is theirs, so the same
// list query powers both the stable calendar and the owner's /my-lessons.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";
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
    const rows = horses.map((h) => ({
      visit_id: visitId,
      horse_id: h.horse_id,
      cost_cents: h.cost_cents ?? null,
      note: h.note?.toString().trim() || null,
    }));
    const { error: jerr } = await supabase.from("farrier_visit_horses").insert(rows);
    if (jerr) throw jerr;
  }

  const expenseId = await syncVisitExpense(supabase, {
    role: session.role,
    stableId: session.stableId,
    userId: session.userId,
    existingExpenseId: null,
    expenseCents: input.expense_cents ?? null,
    kind,
    farrierName,
    startsISO: input.starts_at,
  });
  if (expenseId) {
    await supabase.from("farrier_visits").update({ expense_cents: input.expense_cents ?? null, expense_id: expenseId }).eq("id", visitId);
  } else if (input.expense_cents) {
    await supabase.from("farrier_visits").update({ expense_cents: input.expense_cents }).eq("id", visitId);
  }
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

  const expenseId = await syncVisitExpense(supabase, {
    role: session.role,
    stableId: session.stableId,
    userId: session.userId,
    existingExpenseId,
    expenseCents: input.expense_cents ?? null,
    kind,
    farrierName,
    startsISO: input.starts_at,
  });
  await supabase
    .from("farrier_visits")
    .update({ expense_cents: input.expense_cents ?? null, expense_id: expenseId })
    .eq("id", id);

  // Preserve paid_at across the rebuild.
  const { data: existing } = await supabase
    .from("farrier_visit_horses")
    .select("horse_id, paid_at")
    .eq("visit_id", id);
  const paidByHorse = new Map<string, string | null>(
    (existing ?? []).map((r: any) => [r.horse_id, r.paid_at ?? null]),
  );

  const { error: derr } = await supabase
    .from("farrier_visit_horses")
    .delete()
    .eq("visit_id", id);
  if (derr) throw derr;

  const horses = dedupeHorses(input.horses);
  if (horses.length > 0) {
    const rows = horses.map((h) => ({
      visit_id: id,
      horse_id: h.horse_id,
      cost_cents: h.cost_cents ?? null,
      note: h.note?.toString().trim() || null,
      paid_at: paidByHorse.get(h.horse_id) ?? null,
    }));
    const { error: ierr } = await supabase.from("farrier_visit_horses").insert(rows);
    if (ierr) throw ierr;
  }
}

/** Toggle the paid flag for one horse in one visit. Staff only. */
export async function setFarrierHorsePaid(
  visitId: string,
  horseId: string,
  paid: boolean,
): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("set_farrier_horse_paid", {
    p_visit_id: visitId,
    p_horse_id: horseId,
    p_paid: paid,
  });
  if (error) throw error;
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
      cost_cents, note, paid_at,
      visit:farrier_visits!farrier_visit_horses_visit_id_fkey (
        id, kind, starts_at, farrier_name
      )
      `,
    )
    .eq("horse_id", horseId);
  if (error) throw error;

  return (data ?? [])
    .filter((r: any) => r.visit)
    .map((r: any): HorseCareVisit => ({
      id: r.visit.id,
      kind: r.visit.kind === "vet" ? "vet" : "farrier",
      starts_at: r.visit.starts_at,
      farrier_name: r.visit.farrier_name ?? null,
      cost_cents: r.cost_cents ?? null,
      note: r.note ?? null,
      paid_at: r.paid_at ?? null,
    }))
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
