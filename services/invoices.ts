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
  totalItems:      number;
  totalAmount:     number;
};

/** One un-invoiced, billable line for a client — from a lesson, a boarding
 *  charge, a misc client charge, or a farrier/vet per-horse cost. */
type LineDraft = {
  clientId:           string;
  description:        string;
  amount:             number;
  lesson_id?:         string | null;
  boarding_charge_id?: string | null;
  client_charge_id?:  string | null;
  farrier_visit_id?:  string | null;
  farrier_horse_id?:  string | null;
};

/** Gather every billable, unpaid, un-invoiced item in the window across
 *  lessons + boarding + farrier/vet + misc charges. Each source dedupes
 *  against invoice_items so nothing is billed twice. RLS scopes to stable. */
async function collectInvoiceDrafts(periodStart: string, periodEnd: string): Promise<LineDraft[]> {
  const supabase = createSupabaseServerClient();
  const startDate = periodStart.slice(0, 10);
  const endDate = periodEnd.slice(0, 10);
  const drafts: LineDraft[] = [];

  // 1. Lessons — completed, priced, not already invoiced.
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, client_id, starts_at, price")
    .gte("starts_at", periodStart).lte("starts_at", periodEnd)
    .eq("status", "completed");
  const lessonRows = (lessons ?? []) as Array<{ id: string; client_id: string; starts_at: string; price: number | null }>;
  const lessonIds = lessonRows.map((l) => l.id);
  const invoicedLessons = new Set<string>();
  if (lessonIds.length) {
    const { data } = await supabase.from("invoice_items").select("lesson_id").in("lesson_id", lessonIds);
    for (const it of (data ?? []) as Array<{ lesson_id: string | null }>) if (it.lesson_id) invoicedLessons.add(it.lesson_id);
  }
  for (const l of lessonRows) {
    if (!l.client_id || invoicedLessons.has(l.id)) continue;
    const p = Number(l.price ?? 0);
    if (p <= 0) continue; // package-covered
    drafts.push({ clientId: l.client_id, description: `Lesson · ${new Date(l.starts_at).toLocaleDateString("en-GB")}`, amount: p, lesson_id: l.id });
  }

  // 2. Boarding charges — unpaid, in period (billed to the horse's owner).
  const { data: boarding } = await supabase
    .from("horse_boarding_summary")
    .select("id, owner_client_id, period_label, period_start, amount, paid_amount, payment_status")
    .gte("period_start", startDate).lte("period_start", endDate);
  const boardingRows = (boarding ?? []) as Array<any>;
  const boardingIds = boardingRows.map((b) => b.id);
  const invoicedBoarding = new Set<string>();
  if (boardingIds.length) {
    const { data } = await supabase.from("invoice_items").select("boarding_charge_id").in("boarding_charge_id", boardingIds);
    for (const it of (data ?? []) as Array<{ boarding_charge_id: string | null }>) if (it.boarding_charge_id) invoicedBoarding.add(it.boarding_charge_id);
  }
  for (const b of boardingRows) {
    if (!b.owner_client_id || b.payment_status === "paid" || invoicedBoarding.has(b.id)) continue;
    const due = Number(b.amount) - Number(b.paid_amount);
    if (due <= 0) continue;
    drafts.push({ clientId: b.owner_client_id, description: `Boarding · ${b.period_label ?? b.period_start}`, amount: due, boarding_charge_id: b.id });
  }

  // 3. Misc client charges — unpaid, in period.
  const { data: misc } = await supabase
    .from("client_charge_summary")
    .select("id, client_id, kind, custom_label, incurred_on, amount, paid_amount, payment_status")
    .gte("incurred_on", startDate).lte("incurred_on", endDate);
  const miscRows = (misc ?? []) as Array<any>;
  const miscIds = miscRows.map((m) => m.id);
  const invoicedMisc = new Set<string>();
  if (miscIds.length) {
    const { data } = await supabase.from("invoice_items").select("client_charge_id").in("client_charge_id", miscIds);
    for (const it of (data ?? []) as Array<{ client_charge_id: string | null }>) if (it.client_charge_id) invoicedMisc.add(it.client_charge_id);
  }
  for (const m of miscRows) {
    if (!m.client_id || m.payment_status === "paid" || invoicedMisc.has(m.id)) continue;
    const due = Number(m.amount) - Number(m.paid_amount);
    if (due <= 0) continue;
    const label = m.custom_label || m.kind || "Charge";
    drafts.push({ clientId: m.client_id, description: `${label} · ${m.incurred_on}`, amount: due, client_charge_id: m.id });
  }

  // 4. Farrier/vet per-horse costs — unpaid (billed to the horse's owner).
  const { data: care } = await supabase
    .from("farrier_visit_horses")
    .select(`cost_cents, paid_at,
      horse:horses!farrier_visit_horses_horse_id_fkey ( id, owner_client_id ),
      visit:farrier_visits!farrier_visit_horses_visit_id_fkey ( id, starts_at, kind, farrier_name )`)
    .not("cost_cents", "is", null)
    .is("paid_at", null);
  const careRows = (care ?? []) as Array<any>;
  const careVisitIds = Array.from(new Set(careRows.map((r) => r.visit?.id).filter(Boolean)));
  const invoicedCare = new Set<string>();
  if (careVisitIds.length) {
    const { data } = await supabase.from("invoice_items").select("farrier_visit_id, farrier_horse_id").in("farrier_visit_id", careVisitIds);
    for (const it of (data ?? []) as Array<{ farrier_visit_id: string | null; farrier_horse_id: string | null }>) {
      if (it.farrier_visit_id && it.farrier_horse_id) invoicedCare.add(`${it.farrier_visit_id}:${it.farrier_horse_id}`);
    }
  }
  for (const r of careRows) {
    const v = r.visit; const h = r.horse;
    if (!v || !h || !h.owner_client_id) continue;
    const d = String(v.starts_at).slice(0, 10);
    if (d < startDate || d > endDate) continue;
    if (invoicedCare.has(`${v.id}:${h.id}`)) continue;
    const amt = Number(r.cost_cents) / 100;
    if (amt <= 0) continue;
    const label = v.kind === "vet" ? "Vet" : "Farrier";
    drafts.push({
      clientId: h.owner_client_id,
      description: `${label} · ${new Date(v.starts_at).toLocaleDateString("en-GB")}${v.farrier_name ? ` · ${v.farrier_name}` : ""}`,
      amount: amt,
      farrier_visit_id: v.id,
      farrier_horse_id: h.id,
    });
  }

  return drafts;
}

/** Read-only preview across all billable sources. */
export async function previewMonthlyInvoices(periodStart: string, periodEnd: string): Promise<GeneratePreview> {
  await getSession();
  const drafts = await collectInvoiceDrafts(periodStart, periodEnd);
  const clients = new Set<string>();
  let totalAmount = 0;
  for (const d of drafts) { clients.add(d.clientId); totalAmount += d.amount; }
  return { eligibleClients: clients.size, totalItems: drafts.length, totalAmount };
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

/** Bulk status change — one UPDATE … WHERE id IN (...). Used by the
 *  invoices list multi-select "Mark paid" action. RLS still scopes the
 *  update to the caller's stable, so a forged id from another stable is
 *  a no-op. Returns the number of rows actually changed. */
export async function setInvoiceStatusBulk(
  invoiceIds: string[],
  status: "issued" | "paid" | "overdue" | "cancelled",
): Promise<number> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  void session;
  const ids = Array.from(new Set(invoiceIds)).filter(Boolean);
  if (ids.length === 0) return 0;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("invoices")
    .update({ status })
    .in("id", ids)
    .select("id");
  if (error) throw error;
  return (data ?? []).length;
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

/** Generate invoices for every client with unpaid, un-invoiced items in
 *  [periodStart, periodEnd] — lessons, boarding, farrier/vet, and misc
 *  charges all roll into one invoice per client. Returns counts. */
export async function generateMonthlyInvoices(periodStart: string, periodEnd: string): Promise<GenerateResult> {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const issuer = await getStableIssuer();
  if (!isIssuerReady(issuer)) {
    return { created: 0, totalAmount: 0, skippedClients: 0, warning: "ISSUER_NOT_READY" };
  }

  const supabase = createSupabaseServerClient();

  // Gather every billable line across all sources, then group by client.
  const drafts = await collectInvoiceDrafts(periodStart, periodEnd);
  const byClient = new Map<string, LineDraft[]>();
  for (const d of drafts) {
    const arr = byClient.get(d.clientId) ?? [];
    arr.push(d);
    byClient.set(d.clientId, arr);
  }

  if (byClient.size === 0) {
    return { created: 0, totalAmount: 0, skippedClients: 0 };
  }

  let created = 0;
  let totalAmount = 0;

  for (const [clientId, items] of byClient.entries()) {
    const subtotal = items.reduce((acc, it) => acc + it.amount, 0);
    const total    = subtotal; // no VAT unless issuer is registered — Sprint 6 #1b

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
      invoice_id:         invoiceId,
      lesson_id:          it.lesson_id ?? null,
      boarding_charge_id: it.boarding_charge_id ?? null,
      client_charge_id:   it.client_charge_id ?? null,
      farrier_visit_id:   it.farrier_visit_id ?? null,
      farrier_horse_id:   it.farrier_horse_id ?? null,
      description:        it.description,
      quantity:           1,
      unit_price:         it.amount,
      line_total:         it.amount,
      position:           idx,
    }));
    await supabase.from("invoice_items").insert(itemRows);

    created     += 1;
    totalAmount += total;
  }

  return { created, totalAmount, skippedClients: 0 };
}
