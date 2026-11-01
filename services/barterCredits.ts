// Barter / work-for-credit entries. The owner logs work a client's person
// does for the stable (date, what they did, amount) which becomes stable
// CREDIT for that client. The credit feeds the normal balance + available-
// credit pool (see migration 121 + services/payments.ts), and is spent the
// usual way ("Use credit" on a lesson/charge). Owner-only writes; staff and
// the client themselves can read (RLS).

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole, requireOwnerOrClientSelf } from "@/lib/auth/session";

export type BarterCreditEntry = {
  id: string;
  entry_date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  created_at: string;
};

export async function listBarterCredits(clientId: string): Promise<BarterCreditEntry[]> {
  const session = await getSession();
  requireOwnerOrClientSelf(session, clientId);
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("client_credit_entries")
    .select("id, entry_date, description, amount, created_at")
    .eq("client_id", clientId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<{ id: string; entry_date: string; description: string; amount: number | string; created_at: string }>)
    .map((r) => ({ id: r.id, entry_date: r.entry_date, description: r.description, amount: Number(r.amount), created_at: r.created_at }));
}

/** Sum of all barter credit a client has earned (gross, before spending). */
export async function getBarterCreditTotal(clientId: string): Promise<number> {
  const rows = await listBarterCredits(clientId);
  return Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100;
}

export type CreateBarterInput = {
  clientId: string;
  entryDate: string; // YYYY-MM-DD
  description: string;
  amount: number;
};

export async function createBarterCredit(input: CreateBarterInput): Promise<{ id: string }> {
  const session = await getSession();
  requireRole(session, "owner");
  const desc = input.description?.trim();
  if (!desc) throw new Error("DESCRIPTION_REQUIRED");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("INVALID_AMOUNT");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.entryDate)) throw new Error("INVALID_DATE");
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("client_credit_entries")
    .insert({
      stable_id: session.stableId,
      client_id: input.clientId,
      entry_date: input.entryDate,
      description: desc,
      amount: Math.round(input.amount * 100) / 100,
      created_by: session.userId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: (data as { id: string }).id };
}

export async function deleteBarterCredit(id: string): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("client_credit_entries").delete().eq("id", id);
  if (error) throw error;
}
