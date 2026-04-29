// Per-client misc charges service. Anything outside lessons / packages
// / boarding — farrier, equipment, supplements, vet co-pay, transport,
// extra training time, "other" with a custom label.
//
// Same-shape mirror of services/boarding.ts so the UI can reuse the
// paid/unpaid pill + Mark paid / Mark unpaid mini-form pattern.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getSession,
  requireRole,
  requireOwnerOrClientSelf,
} from "@/lib/auth/session";

export type ClientChargeKind =
  | "farrier"
  | "equipment"
  | "supplement"
  | "vet_copay"
  | "transport"
  | "training_extra"
  | "other";

export type ClientChargeRow = {
  id: string;
  stable_id: string;
  client_id: string;
  horse_id: string | null;
  kind: ClientChargeKind;
  custom_label: string | null;
  amount: number;
  incurred_on: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  paid_amount: number;
  payment_status: "paid" | "partial" | "unpaid";
};

export type CreateClientChargeInput = {
  clientId: string;
  horseId?: string | null;
  kind: ClientChargeKind;
  customLabel?: string | null;
  amount: number;
  incurredOn?: string;
  notes?: string | null;
};

// ---------- writes (owner only) -----------------------------------

export async function createClientCharge(
  input: CreateClientChargeInput,
): Promise<ClientChargeRow> {
  const session = await getSession();
  requireRole(session, "owner");
  if (input.amount <= 0) throw new Error("INVALID_AMOUNT");
  if (input.kind === "other" && !input.customLabel?.trim()) {
    throw new Error("CHARGE_LABEL_REQUIRED");
  }

  const supabase = createSupabaseServerClient();
  const { data: charge, error } = await supabase
    .from("client_charges")
    .insert({
      stable_id:    session.stableId,
      client_id:    input.clientId,
      horse_id:     input.horseId ?? null,
      kind:         input.kind,
      custom_label: input.customLabel ?? null,
      amount:       input.amount,
      incurred_on:  input.incurredOn ?? new Date().toISOString().slice(0, 10),
      notes:        input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  // Refetch via summary view so the caller gets paid_amount + status.
  const { data, error: vErr } = await supabase
    .from("client_charge_summary")
    .select("*")
    .eq("id", (charge as { id: string }).id)
    .single();
  if (vErr) throw vErr;
  return data as ClientChargeRow;
}

export async function deleteClientCharge(chargeId: string): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("client_charges")
    .delete()
    .eq("id", chargeId);
  if (error) throw error;
}

/** One-click "Mark paid". Creates a payments row for the remaining
 *  amount, linked via client_charge_id. */
export async function markClientChargePaid(
  chargeId: string,
  method: "cash" | "card" | "transfer" | "other" = "cash",
): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("client_charge_summary")
    .select("id, client_id, amount, paid_amount")
    .eq("id", chargeId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("CHARGE_NOT_FOUND");
  const c = data as { id: string; client_id: string; amount: number; paid_amount: number };
  const remaining = Number(c.amount) - Number(c.paid_amount);
  if (remaining <= 0) return;

  const { error: pErr } = await supabase
    .from("payments")
    .insert({
      stable_id:           session.stableId,
      client_id:           c.client_id,
      lesson_id:           null,
      package_id:          null,
      boarding_charge_id:  null,
      client_charge_id:    c.id,
      amount:              remaining,
      method,
      paid_at:             new Date().toISOString(),
      notes:               "Misc charge payment",
    });
  if (pErr) throw pErr;
}

export async function markClientChargeUnpaid(chargeId: string): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("payments")
    .delete()
    .eq("client_charge_id", chargeId);
  if (error) throw error;
}

// ---------- reads -------------------------------------------------

export async function listClientCharges(
  clientId: string,
): Promise<ClientChargeRow[]> {
  const session = await getSession();
  requireOwnerOrClientSelf(session, clientId);
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("client_charge_summary")
    .select("*")
    .eq("client_id", clientId)
    .order("incurred_on", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ClientChargeRow[];
}

export async function listChargesForHorse(
  horseId: string,
): Promise<ClientChargeRow[]> {
  await getSession();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("client_charge_summary")
    .select("*")
    .eq("horse_id", horseId)
    .order("incurred_on", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ClientChargeRow[];
}
