// Invoices — bulk monthly generation. Scans completed, unpaid,
// uninvoiced lessons in a date window, groups by client, and creates
// one invoice per client.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";
import { getStableIssuer, isIssuerReady, type StableIssuer } from "@/services/stableIssuer";
import { sendEmail, emailFooter } from "@/lib/email/send";
import { startDirectChat, sendChatMessage } from "@/services/chat";

const esc = (s: string) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

/** VAT breakdown for an invoice from a subtotal + the stable's rate (%). */
function vatFor(subtotal: number, ratePct: number): { rate: number; amount: number; total: number } {
  const rate = Number(ratePct) || 0;
  const amount = Math.round(subtotal * rate) / 100; // subtotal * (rate/100), 2dp
  return { rate, amount, total: Math.round((subtotal + amount) * 100) / 100 };
}

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
  kind:         "invoice" | "proforma";
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

  // 1. Lessons — completed OR no-show, priced, not already invoiced.
  //    No-shows are billable (the client still owes the fee) and the
  //    balance/owed-items logic counts them, so invoices must too —
  //    otherwise a no-show shows as outstanding but never lands on a bill.
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, client_id, starts_at, price, status")
    .gte("starts_at", periodStart).lte("starts_at", periodEnd)
    .in("status", ["completed", "no_show"]);
  const lessonRows = (lessons ?? []) as Array<{ id: string; client_id: string; starts_at: string; price: number | null; status: string }>;
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
    const noShow = l.status === "no_show" ? " (no-show)" : "";
    drafts.push({ clientId: l.client_id, description: `Lesson · ${new Date(l.starts_at).toLocaleDateString("en-GB")}${noShow}`, amount: p, lesson_id: l.id });
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

  // Farrier/vet per-horse costs now live in the client-charge ledger
  // (kinds farrier / vet_copay), so they are already collected by step 3
  // above — no separate source needed (and no risk of double-billing).

  return drafts;
}

/** Generate a single finance invoice for ONE client covering everything
 *  they currently owe (all unpaid, un-invoiced items, any date). Used by
 *  the "Print invoice" button on a client profile so it routes through the
 *  same numbered, listed, branded invoice as bulk generation — instead of
 *  the old ad-hoc preview. Returns null when nothing is outstanding. */
export async function generateInvoiceForClient(clientId: string): Promise<{ id: string | null }> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  const issuer = await getStableIssuer();
  if (!isIssuerReady(issuer)) throw new Error("ISSUER_NOT_READY");
  const supabase = createSupabaseServerClient();

  const all = await collectInvoiceDrafts("2000-01-01T00:00:00.000Z", "2999-12-31T23:59:59.999Z");
  const items = all.filter((d) => d.clientId === clientId);
  if (items.length === 0) return { id: null };

  const subtotal = items.reduce((a, it) => a + it.amount, 0);
  const vat = vatFor(subtotal, issuer.vat_rate);
  const { data: numberRpc, error: rpcErr } = await supabase
    .rpc("next_invoice_number", { p_stable_id: session.stableId });
  if (rpcErr || !numberRpc) throw new Error("NUMBERING_FAILED");

  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .insert({
      stable_id: session.stableId,
      client_id: clientId,
      number: numberRpc as string,
      subtotal,
      vat_rate: vat.rate,
      vat_amount: vat.amount,
      total: vat.total,
      status: "issued",
    })
    .select("id")
    .single();
  if (invErr || !inv) throw invErr ?? new Error("INSERT_FAILED");

  const invoiceId = (inv as { id: string }).id;
  await supabase.from("invoice_items").insert(
    items.map((it, idx) => ({
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
    })),
  );
  return { id: invoiceId };
}

/** Create a one-line custom invoice for a client (free-text service + amount)
 *  — for a charge that isn't one of the tracked outstanding items. Same
 *  numbering / branding path as the generated invoices. */
export async function createCustomInvoiceForClient(
  clientId: string,
  description: string,
  amount: number,
): Promise<{ id: string }> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  const issuer = await getStableIssuer();
  if (!isIssuerReady(issuer)) throw new Error("ISSUER_NOT_READY");
  const supabase = createSupabaseServerClient();

  const desc = description.trim() || "Service";
  const amt = Math.round((Number(amount) || 0) * 100) / 100;
  if (!(amt > 0)) throw new Error("INVALID_AMOUNT");

  const { data: numberRpc, error: rpcErr } = await supabase
    .rpc("next_invoice_number", { p_stable_id: session.stableId });
  if (rpcErr || !numberRpc) throw new Error("NUMBERING_FAILED");

  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .insert({
      stable_id: session.stableId,
      client_id: clientId,
      number: numberRpc as string,
      subtotal: amt,
      vat_rate: vatFor(amt, issuer.vat_rate).rate,
      vat_amount: vatFor(amt, issuer.vat_rate).amount,
      total: vatFor(amt, issuer.vat_rate).total,
      status: "issued",
    })
    .select("id")
    .single();
  if (invErr || !inv) throw invErr ?? new Error("INSERT_FAILED");

  const invoiceId = (inv as { id: string }).id;
  await supabase.from("invoice_items").insert({
    invoice_id: invoiceId,
    description: desc,
    quantity: 1,
    unit_price: amt,
    line_total: amt,
    position: 0,
  });
  return { id: invoiceId };
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

/** Email a branded copy of the invoice to the client's email on file.
 *  Staff only. Throws NO_CLIENT_EMAIL when there's no address. */
export async function emailInvoiceToClient(invoiceId: string): Promise<{ sentTo: string }> {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const detail = await getInvoiceDetail(invoiceId);
  if (!detail) throw new Error("INVOICE_NOT_FOUND");
  const { invoice, items, issuer } = detail;
  const to = invoice.client?.email?.trim();
  if (!to) throw new Error("NO_CLIENT_EMAIL");

  const eur = (n: number | string) => `€${Number(n).toFixed(2)}`;
  const fromName = issuer.legal_name ?? "Your stable";

  const rows = items
    .map(
      (it) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #ECE7DD;color:#26303B">${esc(it.description)}</td>
         <td align="right" style="padding:8px 0;border-bottom:1px solid #ECE7DD;color:#26303B;white-space:nowrap">${eur(it.line_total)}</td></tr>`,
    )
    .join("");

  const html = `
  <div style="font-family:Georgia,'Times New Roman',serif;max-width:560px;margin:0 auto;color:#26303B">
    <p style="font-size:20px;margin:0 0 4px"><strong>Longrein.</strong></p>
    <p style="font-size:13px;color:#6B675E;margin:0 0 20px">Invoice from ${esc(fromName)}</p>
    <h1 style="font-size:18px;margin:0 0 2px">Invoice ${esc(invoice.number)}</h1>
    <p style="font-size:13px;color:#6B675E;margin:0 0 18px">Issued ${new Date(invoice.issued_at).toLocaleDateString("en-GB")}${invoice.due_at ? ` · Due ${new Date(invoice.due_at).toLocaleDateString("en-GB")}` : ""}</p>
    <table style="width:100%;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:14px">
      ${rows}
      <tr><td style="padding:12px 0 0;font-weight:bold">Total</td>
          <td align="right" style="padding:12px 0 0;font-weight:bold;font-size:16px">${eur(invoice.total)}</td></tr>
    </table>
    <div style="margin-top:22px;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:#6B675E;line-height:1.6">
      <strong style="color:#26303B">${esc(fromName)}</strong><br/>
      ${issuer.business_code ? `Reg. ${esc(issuer.business_code)}<br/>` : ""}
      ${issuer.vat_code ? `VAT ${esc(issuer.vat_code)}<br/>` : ""}
      ${issuer.business_address ? `${esc(issuer.business_address)}<br/>` : ""}
      ${issuer.iban ? `IBAN ${esc(issuer.iban)}` : ""}
    </div>
    ${emailFooter()}
  </div>`;

  await sendEmail({
    to,
    subject: `Invoice ${invoice.number} from ${fromName}`,
    html,
  });
  return { sentTo: to };
}

/** Deliver the invoice into the client↔stable chat thread with a tappable
 *  link to the (print-to-PDF) invoice view. Returns false when the client
 *  has no app account to message. Caller decides whether that's an error. */
export async function deliverInvoiceToClientChat(invoiceId: string): Promise<boolean> {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();
  const { data: inv } = await supabase
    .from("invoices")
    .select("id, number, total, client_id")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) return false;
  const i = inv as { id: string; number: string; total: number | string; client_id: string };

  const { data: client } = await supabase
    .from("clients")
    .select("profile_id")
    .eq("id", i.client_id)
    .maybeSingle();
  const profileId = (client as { profile_id: string | null } | null)?.profile_id;
  if (!profileId) return false; // client isn't on the app

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.longrein.eu").replace(/\/+$/, "");
  const url = `${base}/dashboard/my-invoices/${i.id}`;
  const body = `Invoice ${i.number} — €${Number(i.total).toFixed(2)}. View & download PDF: ${url}`;

  const threadId = await startDirectChat(profileId);
  await sendChatMessage(threadId, body);
  return true;
}

export type SendInvoiceResult = {
  emailedTo:  string | null;
  chatPosted: boolean;
  notes:      string[];
};

/** Owner/trainer sends an invoice via email, chat, or both — their choice. */
export async function sendInvoiceToClient(
  invoiceId: string,
  channels: { email: boolean; chat: boolean },
): Promise<SendInvoiceResult> {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const notes: string[] = [];
  let emailedTo: string | null = null;
  let chatPosted = false;

  if (channels.email) {
    try {
      const r = await emailInvoiceToClient(invoiceId);
      emailedTo = r.sentTo;
    } catch (err) {
      const m = (err as Error)?.message ?? "";
      notes.push(m === "NO_CLIENT_EMAIL" ? "No email on file — email skipped." : "Email failed.");
    }
  }
  if (channels.chat) {
    try {
      chatPosted = await deliverInvoiceToClientChat(invoiceId);
      if (!chatPosted) notes.push("Client isn't on the app — chat skipped.");
    } catch {
      notes.push("Chat delivery failed.");
    }
  }
  return { emailedTo, chatPosted, notes };
}

// Supabase client type is inferred; keep the helpers loosely typed.
/* eslint-disable @typescript-eslint/no-explicit-any */

/** Marking an invoice paid records the money so revenue + the client's
 *  balance actually move (client_account_summary = payments − charges;
 *  an invoice on its own isn't a charge). We create ONE payment per line
 *  item, linked to that item's source charge (lesson / boarding / misc) so
 *  finance buckets it correctly AND it can't double-count a charge already
 *  settled via its own "Mark paid" (we skip any charge that already has a
 *  payment). Idempotent: no-op if the invoice already has payments. */
async function applyInvoicePaymentSet(supabase: any, stableId: string, invoiceId: string): Promise<void> {
  const { data: already } = await supabase.from("payments").select("id").eq("invoice_id", invoiceId).limit(1);
  if (already && already.length) return;

  const { data: inv } = await supabase.from("invoices").select("client_id, number").eq("id", invoiceId).maybeSingle();
  const invRow = inv as { client_id: string | null; number: string } | null;
  if (!invRow?.client_id) return;

  const { data: items } = await supabase
    .from("invoice_items")
    .select("line_total, lesson_id, boarding_charge_id, client_charge_id")
    .eq("invoice_id", invoiceId);
  const itemRows = (items ?? []) as Array<{
    line_total: number | string;
    lesson_id: string | null;
    boarding_charge_id: string | null;
    client_charge_id: string | null;
  }>;
  if (itemRows.length === 0) return;

  // Charges this client has ALREADY paid — so we don't double-pay one that
  // was settled directly (e.g. boarding "Mark paid").
  const { data: prior } = await supabase
    .from("payments")
    .select("lesson_id, boarding_charge_id, client_charge_id")
    .eq("client_id", invRow.client_id);
  const paidLesson = new Set((prior ?? []).map((p: any) => p.lesson_id).filter(Boolean));
  const paidBoard  = new Set((prior ?? []).map((p: any) => p.boarding_charge_id).filter(Boolean));
  const paidCharge = new Set((prior ?? []).map((p: any) => p.client_charge_id).filter(Boolean));

  // A line item can reference a charge that was later DELETED (dangling id) or,
  // in messy data, one in another stable. A payments trigger enforces
  // same-stable links, so we must only attach links that still resolve in THIS
  // stable — otherwise the whole "mark paid" would throw. Invalid links are
  // dropped and the payment is recorded as a plain invoice payment.
  const boardIds  = itemRows.map((it) => it.boarding_charge_id).filter(Boolean) as string[];
  const lessonIds = itemRows.map((it) => it.lesson_id).filter(Boolean) as string[];
  const chargeIds = itemRows.map((it) => it.client_charge_id).filter(Boolean) as string[];
  const validBoard  = new Set<string>();
  const validLesson = new Set<string>();
  const validCharge = new Set<string>();
  if (boardIds.length) {
    const { data } = await supabase.from("horse_boarding_charges").select("id").eq("stable_id", stableId).in("id", boardIds);
    (data ?? []).forEach((r: any) => validBoard.add(r.id));
  }
  if (lessonIds.length) {
    const { data } = await supabase.from("lessons").select("id").eq("stable_id", stableId).in("id", lessonIds);
    (data ?? []).forEach((r: any) => validLesson.add(r.id));
  }
  if (chargeIds.length) {
    const { data } = await supabase.from("client_charges").select("id").eq("stable_id", stableId).in("id", chargeIds);
    (data ?? []).forEach((r: any) => validCharge.add(r.id));
  }

  const now = new Date().toISOString();
  const rows = itemRows
    .filter((it) => {
      if (it.lesson_id && paidLesson.has(it.lesson_id)) return false;
      if (it.boarding_charge_id && paidBoard.has(it.boarding_charge_id)) return false;
      if (it.client_charge_id && paidCharge.has(it.client_charge_id)) return false;
      return Number(it.line_total) > 0;
    })
    .map((it) => ({
      stable_id: stableId,
      client_id: invRow.client_id,
      amount: it.line_total,
      method: "other",
      paid_at: now,
      invoice_id: invoiceId,
      notes: `Invoice ${invRow.number}`,
      lesson_id: it.lesson_id && validLesson.has(it.lesson_id) ? it.lesson_id : null,
      boarding_charge_id: it.boarding_charge_id && validBoard.has(it.boarding_charge_id) ? it.boarding_charge_id : null,
      client_charge_id: it.client_charge_id && validCharge.has(it.client_charge_id) ? it.client_charge_id : null,
    }));

  if (rows.length > 0) {
    const { error } = await supabase.from("payments").insert(rows);
    if (error) throw error;
  }
}

/** Reverse the auto-created payments when an invoice leaves 'paid'. */
async function removeInvoicePaymentSet(supabase: any, invoiceId: string): Promise<void> {
  const { error } = await supabase.from("payments").delete().eq("invoice_id", invoiceId);
  if (error) throw error;
}

export async function setInvoiceStatus(
  invoiceId: string,
  status: "issued" | "paid" | "overdue" | "cancelled",
): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("invoices")
    .update({ status })
    .eq("id", invoiceId);
  if (error) throw error;
  if (status === "paid") await applyInvoicePaymentSet(supabase, session.stableId, invoiceId);
  else await removeInvoicePaymentSet(supabase, invoiceId);
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
  const ids = Array.from(new Set(invoiceIds)).filter(Boolean);
  if (ids.length === 0) return 0;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("invoices")
    .update({ status })
    .in("id", ids)
    .select("id");
  if (error) throw error;
  const changed = (data ?? []) as Array<{ id: string }>;
  // Record / reverse the money for each affected invoice.
  for (const row of changed) {
    if (status === "paid") await applyInvoicePaymentSet(supabase, session.stableId, row.id);
    else await removeInvoicePaymentSet(supabase, row.id);
  }
  return changed.length;
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
    const vat      = vatFor(subtotal, issuer.vat_rate);
    const total    = vat.total;

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
        vat_rate:     vat.rate,
        vat_amount:   vat.amount,
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
