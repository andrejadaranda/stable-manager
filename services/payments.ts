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
  /** Settle a specific boarding month — links the payment so the month
   *  flips to paid in horse_boarding_summary automatically. */
  boardingChargeId?: string | null;
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
      boarding_charge_id: input.boardingChargeId ?? null,
      paid_at: input.paidAt ?? new Date().toISOString(),
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Edit an existing payment (owner-only). Only the fields the owner can
 *  reasonably change: amount, method, paid date, note. Client/lesson links
 *  stay put — delete + re-add if those are wrong. */
export async function updatePayment(input: {
  id: string;
  amount?: number;
  method?: "cash" | "card" | "transfer" | "other";
  paidAt?: string;
  notes?: string | null;
}): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner");
  void session;
  const update: Record<string, unknown> = {};
  if (input.amount !== undefined) {
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("INVALID_AMOUNT");
    update.amount = input.amount;
  }
  if (input.method !== undefined) update.method = input.method;
  if (input.paidAt !== undefined) update.paid_at = input.paidAt;
  if (input.notes  !== undefined) update.notes  = input.notes;

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("payments").update(update).eq("id", input.id);
  if (error) throw error;
}

/** Delete a payment. Owner-only. Used by the payments list to remove a
 *  wrong/duplicate entry — the client balance recomputes automatically. */
export async function deletePayment(paymentId: string): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner");
  void session;
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("payments").delete().eq("id", paymentId);
  if (error) throw error;
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
      lesson:lessons(id, starts_at, horse:horses!lessons_horse_id_fkey(id, name))
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

// =================================================================
// Owes breakdown — what the client actually owes for, line by line.
//
// Aggregates three kinds of outstanding items into one chronologically
// sorted list so the owner can see "why does this person owe X?" at a
// glance and tap a single Mark paid button per line:
//
//   1. Unpaid lessons        — lessons with status in ('completed','no_show'),
//                              positive price, NOT package-covered, and
//                              SUM(payments.amount) < price.
//   2. Unpaid misc charges   — client_charge_summary.payment_status != 'paid'
//   3. Unpaid boarding fees  — horse_boarding_summary.payment_status != 'paid'
//
// The shape is intentionally flat (one item per row) instead of grouped
// per kind so the UI can render a single timeline. Each entry carries
// enough metadata that the inline action knows which service to call.
//
// Owner-only — feeds the client detail page. Client portal already has
// its own dedicated views for lessons / boarding / charges separately.
// =================================================================
export type OwedItem =
  | {
      kind: "lesson";
      id: string;
      /** Display label — e.g. "12 Mar · Tornado · Cash lesson". */
      label: string;
      /** Lesson date, used for sorting + display. */
      occurredAt: string;
      /** Charge total in EUR. */
      amount: number;
      /** Already paid against this item. Lessons can be partially paid. */
      paid: number;
      /** amount - paid, never negative. */
      owed: number;
      /** Optional secondary line (horse, notes). */
      sub: string | null;
    }
  | {
      kind: "charge";
      id: string;
      label: string;
      occurredAt: string;
      amount: number;
      paid: number;
      owed: number;
      sub: string | null;
    }
  | {
      kind: "boarding";
      id: string;
      label: string;
      occurredAt: string;
      amount: number;
      paid: number;
      owed: number;
      sub: string | null;
    };

const CHARGE_KIND_LABELS: Record<string, string> = {
  farrier:        "Farrier",
  equipment:      "Equipment",
  supplement:     "Supplement",
  vet_copay:      "Vet co-pay",
  transport:      "Transport",
  training_extra: "Extra training",
  other:          "Other",
};

export async function listClientOwedItems(clientId: string): Promise<OwedItem[]> {
  const session = await getSession();
  requireRole(session, "owner");

  const supabase = createSupabaseServerClient();

  // Three parallel queries — every kind is filtered server-side to its
  // unpaid subset so we don't drag the full history over the wire.
  const [lessonsRes, chargesRes, boardingRes] = await Promise.all([
    // Lessons: status in completed/no_show, price > 0, no package, plus
    // joined payments to compute paid-so-far client-side (Postgres
    // doesn't let us filter on a derived aggregate in the SELECT).
    supabase
      .from("lessons")
      .select(
        `
        id, starts_at, price, package_id, status,
        horse:horses(name),
        payments(amount)
        `,
      )
      .eq("client_id", clientId)
      .in("status", ["completed", "no_show"])
      .gt("price", 0)
      .is("package_id", null)
      .order("starts_at", { ascending: true }),

    supabase
      .from("client_charge_summary")
      .select("id, kind, custom_label, incurred_on, amount, paid_amount, payment_status, notes")
      .eq("client_id", clientId)
      .neq("payment_status", "paid")
      .order("incurred_on", { ascending: true }),

    supabase
      .from("horse_boarding_summary")
      .select("id, horse_id, period_start, period_label, amount, paid_amount, payment_status")
      .eq("owner_client_id", clientId)
      .neq("payment_status", "paid")
      .order("period_start", { ascending: true }),
  ]);

  if (lessonsRes.error)  throw lessonsRes.error;
  if (chargesRes.error)  throw chargesRes.error;
  if (boardingRes.error) throw boardingRes.error;

  const items: OwedItem[] = [];

  for (const row of (lessonsRes.data ?? []) as Array<{
    id: string;
    starts_at: string;
    price: number | string;
    status: string;
    horse: { name: string } | { name: string }[] | null;
    payments: { amount: number | string }[] | null;
  }>) {
    const price = Number(row.price);
    const paid  = (row.payments ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const owed  = Math.max(0, price - paid);
    if (owed <= 0) continue;  // safety: filter out fully-paid rows

    // Supabase returns joined single-row relations as an object in
    // some shapes and an array in others depending on the FK type;
    // normalise both.
    const horseName =
      Array.isArray(row.horse) ? row.horse[0]?.name ?? null : row.horse?.name ?? null;

    const date = row.starts_at.slice(0, 10);
    items.push({
      kind: "lesson",
      id:   row.id,
      label: row.status === "no_show" ? "Lesson (no-show)" : "Lesson",
      occurredAt: row.starts_at,
      amount: price,
      paid,
      owed,
      sub: horseName ? `${horseName} · ${date}` : date,
    });
  }

  for (const row of (chargesRes.data ?? []) as Array<{
    id: string;
    kind: string;
    custom_label: string | null;
    incurred_on: string;
    amount: number | string;
    paid_amount: number | string;
    notes: string | null;
  }>) {
    const amount = Number(row.amount);
    const paid   = Number(row.paid_amount);
    const owed   = Math.max(0, amount - paid);
    if (owed <= 0) continue;
    const label =
      row.custom_label?.trim() ||
      CHARGE_KIND_LABELS[row.kind] ||
      "Charge";
    items.push({
      kind: "charge",
      id:   row.id,
      label,
      occurredAt: row.incurred_on,
      amount,
      paid,
      owed,
      sub: row.notes ?? null,
    });
  }

  for (const row of (boardingRes.data ?? []) as Array<{
    id: string;
    horse_id: string;
    period_start: string;
    period_label: string | null;
    amount: number | string;
    paid_amount: number | string;
  }>) {
    const amount = Number(row.amount);
    const paid   = Number(row.paid_amount);
    const owed   = Math.max(0, amount - paid);
    if (owed <= 0) continue;
    items.push({
      kind: "boarding",
      id:   row.id,
      label: `Boarding · ${row.period_label ?? row.period_start.slice(0, 7)}`,
      occurredAt: row.period_start,
      amount,
      paid,
      owed,
      sub: null,
    });
  }

  // Oldest first — surfaces the most overdue items at the top so the
  // owner can chase them or collect cash on the spot during a visit.
  items.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  return items;
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

// Spending breakdown for the client portal — where the client's money went,
// by category, plus total paid. Same access rules as getClientBalance.
export type ClientSpendingBreakdown = {
  lessons:      number;
  lessonsCount: number;
  boarding:     number;
  care:         number;   // farrier + vet
  other:        number;
  totalBilled:  number;   // sum of the categories above (self-consistent)
  totalPaid:    number;
};

export async function getClientSpendingBreakdown(clientId: string): Promise<ClientSpendingBreakdown> {
  const session = await getSession();
  requireOwnerOrClientSelf(session, clientId);
  const supabase = createSupabaseServerClient();

  const [lessonsRes, chargesRes, boardingRes, acct] = await Promise.all([
    supabase
      .from("lessons")
      .select("price, status")
      .eq("client_id", clientId)
      .in("status", ["completed", "no_show"])
      .gt("price", 0),
    supabase
      .from("client_charge_summary")
      .select("kind, amount")
      .eq("client_id", clientId),
    // Attribute boarding by the OWNER stamped on each charge, not by
    // whoever owns the horse now — otherwise a horse that changed hands
    // misattributes history (matches the balance view + owed items).
    supabase.from("horse_boarding_summary").select("amount").eq("owner_client_id", clientId),
    getClientAccountSummary(clientId).catch(() => null),
  ]);

  let lessons = 0;
  let lessonsCount = 0;
  for (const l of (lessonsRes.data ?? []) as Array<{ price: number | string }>) {
    lessons += Number(l.price);
    lessonsCount += 1;
  }

  let care = 0;
  let other = 0;
  for (const c of (chargesRes.data ?? []) as Array<{ kind: string; amount: number | string }>) {
    if (c.kind === "farrier" || c.kind === "vet_copay") care += Number(c.amount);
    else other += Number(c.amount);
  }

  let boarding = 0;
  for (const b of ((boardingRes.data ?? []) as Array<{ amount: number | string }>)) {
    boarding += Number(b.amount);
  }

  const totalBilled = lessons + boarding + care + other;
  const totalPaid = Number((acct as { total_paid?: number | string } | null)?.total_paid ?? 0);

  return { lessons, lessonsCount, boarding, care, other, totalBilled, totalPaid };
}
