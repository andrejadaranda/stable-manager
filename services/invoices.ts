// Invoices — bulk monthly generation. Scans completed, unpaid,
// uninvoiced lessons in a date window, groups by client, and creates
// one invoice per client.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";
import { getStableIssuer, isIssuerReady, type StableIssuer } from "@/services/stableIssuer";

export type InvoiceRow = {
  id:           string;
  stable_id:    string;
  client_id:    string;
  number:       string;
  issued_at:    string;
  due_at:       string | null;
  period_start: string | null;
  period_end:   string | null;
  subtotal:     number;
  vat_rate:     number;
  vat_amount:   number;
  total:        number;
  status:       "issued" | "paid" | "overdue" | "cancelled";
  notes:        string | null;
};

export type GenerateResult = {
  created:        number;
  totalAmount:    number;
  skippedClients: number;
  warning?:       string;
};

export type InvoiceItemRow = {
  id:           string;
  invoice_id:   string;
  lesson_id:    string | null;
  description:  string;
  quantity:     number;
  unit_price:   number;
  line_total:   number;
  position:     number;
};

export type InvoiceDetail = {
  invoice: InvoiceRow & { client: { id: string; full_name: string; email: string | null; phone: string | null } | null };
  items:   InvoiceItemRow[];
  issuer:  StableIssuer;
};

export type GeneratePreview = {
  eligibleClients: number;
  totalLessons:    number;
  totalAmount:     number;
};

/** Same scan as generateMonthlyInvoices but read-only — used to populate
 *  the "Confirm generation" dialog with a preview. */
export async function previewMonthlyInvoices(periodStart: string, periodEnd: string): Promise<GeneratePreview> {
  await getSession();
  const supabase = createSupabaseServerClient();

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, client_id, price")
    .gte("starts_at", periodStart)
    .lte("starts_at", periodEnd)
    .eq("status", "completed");

  const ids = (lessons ?? []).map((l) => (l as { id: string }).id);
  const invoicedSet = new Set<string>();
  if (ids.length > 0) {
    const { data: items } = await supabase
      .from("invoice_items")
      .select("lesson_id")
      .in("lesson_id", ids);
    for (const it of (items ?? []) as Array<{ lesson_id: string }>) invoicedSet.add(it.lesson_id);
  }

  const clientTotals = new Map<string, number>();
  let totalLessons = 0;
  for (const lRaw of lessons ?? []) {
    const l = lRaw as { id: string; client_id: string; price: number | null };
    if (invoicedSet.has(l.id)) continue;
    const p = Number(l.price ?? 0);
    if (p <= 0) continue;
    clientTotals.set(l.client_id, (clientTotals.get(l.client_id) ?? 0) + p);
    totalLessons += 1;
  }

  let totalAmount = 0;
  for (const t of clientTotals.values()) totalAmount += t;

  return {
    eligibleClients: clientTotals.size,
    totalLessons,
    totalAmount,
  };
}

export async function getInvoiceDetail(invoiceId: string): Promise<InvoiceDetail | null> {
  await getSession();
  const supabase = createSupabaseServerClient();
  const [invRes, itemsRes, issuer] = await Promise.all([
    supabase.from("invoices")
      .select("*, client:clients(id, full_name, email, phone)")
      .eq("id", invoiceId)
      .maybeSingle(),
    supabase.from("invoice_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("position"),
    getStableIssuer(),
  ]);
  if (invRes.error)   throw invRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (!invRes.data)   return null;
  return {
    invoice: invRes.data as never,
    items:   (itemsRes.data ?? []) as InvoiceItemRow[],
    issuer,
  };
}

export async function setInvoiceStatus(
  invoiceId: string,
  status: "issued" | "paid" | "overdue" | "cancelled",
): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  void session;
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("invoices")
    .update({ status })
    .eq("id", invoiceId);
  if (error) throw error;
}

export async function listInvoices(opts: { limit?: number } = {}): Promise<Array<InvoiceRow & { client: { id: string; full_name: string } | null }>> {
  await getSession();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*, client:clients(id, full_name)")
    .order("issued_at", { ascending: false })
    .limit(opts.limit ?? 200);
  if (error) throw error;
  return data as never;
}

/** Generate invoices for every client with completed-but-unpaid-and-
 *  uninvoiced lessons in [periodStart, periodEnd]. Returns counts. */
export async function generateMonthlyInvoices(periodStart: string, periodEnd: string): Promise<GenerateResult> {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const issuer = await getStableIssuer();
  if (!isIssuerReady(issuer)) {
    return {
      created: 0,
      totalAmount: 0,
      skippedClients: 0,
      warning: "ISSUER_NOT_READY",
    };
  }

  const supabase = createSupabaseServerClient();

  // 1. Fetch all completed lessons in window, with their already-invoiced state.
  const { data: lessons, error: lessonsErr } = await supabase
    .from("lessons")
    .select("id, client_id, starts_at, price, status")
    .gte("starts_at", periodStart)
    .lte("starts_at", periodEnd)
    .eq("status", "completed");
  if (lessonsErr) throw lessonsErr;

  // 2. Find lessons already invoiced (via invoice_items.lesson_id).
  const lessonIds = (lessons ?? []).map((l) => (l as { id: string }).id);
  let invoicedSet = new Set<string>();
  if (lessonIds.length > 0) {
    const { data: items } = await supabase
      .from("invoice_items")
      .select("lesson_id")
      .in("lesson_id", lessonIds);
    invoicedSet = new Set(((items ?? []) as Array<{ lesson_id: string }>).map((i) => i.lesson_id));
  }

  // 3. Group remaining lessons by client.
  const byClient = new Map<string, Array<{ id: string; starts_at: string; price: number }>>();
  for (const lRaw of lessons ?? []) {
    const l = lRaw as { id: string; client_id: string; starts_at: string; price: number };
    if (invoicedSet.has(l.id)) continue;
    if (!l.price || Number(l.price) <= 0) continue;  // skip 0-priced (covered by package)
    const arr = byClient.get(l.client_id) ?? [];
    arr.push({ id: l.id, starts_at: l.starts_at, price: Number(l.price) });
    byClient.set(l.client_id, arr);
  }

  if (byClient.size === 0) {
    return { created: 0, totalAmount: 0, skippedClients: 0 };
  }

  // 4. For each client, allocate an invoice number + insert invoice + items.
  let created = 0;
  let totalAmount = 0;

  for (const [clientId, items] of byClient.entries()) {
    const subtotal = items.reduce((acc, it) => acc + it.price, 0);
    const total    = subtotal; // no VAT unless issuer is registered — Sprint 6 #1b

    // Atomic numbering via RPC.
    const { data: numberRpc, error: rpcErr } = await supabase
      .rpc("next_invoice_number", { p_stable_id: session.stableId });
    if (rpcErr || !numberRpc) continue;

    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .insert({
        stable_id:    session.stableId,
        client_id:    clientId,
        number:       numberRpc as string,
        period_start: periodStart.slice(0, 10),
        period_end:   periodEnd.slice(0, 10),
        subtotal,
        vat_rate:     0,
        vat_amount:   0,
        total,
        status:       "issued",
      })
      .select("id")
      .single();
    if (invErr || !inv) continue;

    const invoiceId = (inv as { id: string }).id;
    const itemRows  = items.map((it, idx) => ({
      invoice_id:  invoiceId,
      lesson_id:   it.id,
      description: `Lesson · ${new Date(it.starts_at).toLocaleDateString("en-GB")}`,
      quantity:    1,
      unit_price:  it.price,
      line_total:  it.price,
      position:    idx,
    }));
    await supabase.from("invoice_items").insert(itemRows);

    created     += 1;
    totalAmount += total;
  }

  return { created, totalAmount, skippedClients: 0 };
}
