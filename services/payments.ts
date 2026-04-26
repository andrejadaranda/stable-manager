// Payments service.
// Writes are owner-only.
// Reads: owner sees all in stable; client sees only their own;
// employee has NO access (explicit FORBIDDEN at the service layer
// matches the RLS policy and gives a clean error to UI code).

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getSession,
  requireRole,
  requireOwnerOrClientSelf,
} from "@/lib/auth/session";

export type AddPaymentInput = {
  clientId: string;
  amount: number;
  method?: "cash" | "card" | "transfer" | "other";
  lessonId?: string | null;
  paidAt?: string;     // ISO timestamp; defaults to now()
  notes?: string;
};

// Owner only.
export async function addPayment(input: AddPaymentInput) {
  const session = await getSession();
  requireRole(session, "owner");
  if (input.amount <= 0) throw new Error("INVALID_AMOUNT");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payments")
    .insert({
      stable_id: session.stableId,
      client_id: input.clientId,
      amount: input.amount,
      method: input.method ?? "cash",
      lesson_id: input.lessonId ?? null,
      paid_at: input.paidAt ?? new Date().toISOString(),
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Payment row with client + lesson references joined for display.
export type PaymentRow = {
  id: string;
  stable_id: string;
  client_id: string;
  lesson_id: string | null;
  amount: number;
  method: "cash" | "card" | "transfer" | "other";
  paid_at: string;
  notes: string | null;
  created_at: string;
  client: { id: string; full_name: string } | null;
  lesson: {
    id: string;
    starts_at: string;
    horse: { id: string; name: string } | null;
  } | null;
};

// Owner sees all (optionally filtered by client/window).
// Client sees only their own; employees blocked.
export async function listPayments(opts?: {
  clientId?: string;
  from?: string;
  to?: string;
}): Promise<PaymentRow[]> {
  const session = await getSession();
  if (session.role === "employee") throw new Error("FORBIDDEN");

  if (session.role === "client") {
    if (!session.clientId) throw new Error("CLIENT_NOT_LINKED");
    if (opts?.clientId && opts.clientId !== session.clientId) {
      throw new Error("FORBIDDEN");
    }
  }

  const supabase = createSupabaseServerClient();
  let q = supabase
    .from("payments")
    .select(
      `
      id, stable_id, client_id, lesson_id, amount, method, paid_at, notes, created_at,
      client:clients(id, full_name),
      lesson:lessons(id, starts_at, horse:horses(id, name))
      `,
    )
    .order("paid_at", { ascending: false });

  if (session.role === "client") q = q.eq("client_id", session.clientId!);
  else if (opts?.clientId)        q = q.eq("client_id", opts.clientId);
  if (opts?.from) q = q.gte("paid_at", opts.from);
  if (opts?.to)   q = q.lt("paid_at", opts.to);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as PaymentRow[];
}

// Computed balance via RPC.
// Owner: any client in the stable. Client: own only. Employee: blocked.
export async function getClientBalance(clientId: string) {
  const session = await getSession();
  requireOwnerOrClientSelf(session, clientId);

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("client_balance", {
    p_client_id: clientId,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

// Full account summary view (charged, paid, balance).
// Same access rules as getClientBalance.
export async function getClientAccountSummary(clientId: string) {
  const session = await getSession();
  requireOwnerOrClientSelf(session, clientId);

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("client_account_summary")
    .select("*")
    .eq("client_id", clientId)
    .single();
  if (error) throw error;
  return data;
}
