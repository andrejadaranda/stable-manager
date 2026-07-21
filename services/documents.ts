// Faktūra / proforma document generation (Stage C-2).
//
// For one client + month, split their billable_items into two documents:
//   • faktūra (kind='invoice') — everything already delivered/paid
//   • proforma (kind='išankstinė) — future scheduled items, not yet delivered
//
// No double-billing: line items carry the source FK, and billable_items only
// treats an item as "invoiced" when it appears on a REAL invoice (kind='invoice',
// not cancelled). A proforma therefore never blocks the eventual faktūra — when
// a scheduled item is delivered it's collected onto the real invoice as usual.
// Packages are excluded (billed once at sale, not on a monthly statement).

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";
import { getStableIssuer, isIssuerReady } from "./stableIssuer";
import { collectClientBillables, monthBounds, type ClientBillable } from "./billing";

function vatFor(subtotal: number, ratePct: number): { rate: number; amount: number; total: number } {
  const rate = Number(ratePct) || 0;
  const amount = Math.round(subtotal * rate) / 100;
  return { rate, amount, total: Math.round((subtotal + amount) * 100) / 100 };
}

/** Map a billable line to the invoice_items source FK used for dedup. */
function sourceFk(item: ClientBillable): Record<string, string | null> {
  const base: Record<string, string | null> = {
    lesson_id: null, lesson_participant_id: null, boarding_charge_id: null, client_charge_id: null,
  };
  if (item.itemType === "boarding") return { ...base, boarding_charge_id: item.sourceId };
  if (item.itemType === "charge")   return { ...base, client_charge_id: item.sourceId };
  if (item.itemType === "lesson") {
    // Group-participant rows carry the participant id (title 'Group lesson');
    // individual lessons carry the lesson id.
    return item.title === "Group lesson"
      ? { ...base, lesson_participant_id: item.sourceId }
      : { ...base, lesson_id: item.sourceId };
  }
  return base;
}

export type GeneratedDocuments = {
  invoiceId:  string | null;
  proformaId: string | null;
  invoiceTotal:  number;
  proformaTotal: number;
};

export async function generateClientDocuments(
  clientId: string,
  yearMonth: string,
): Promise<GeneratedDocuments> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  const issuer = await getStableIssuer();
  if (!isIssuerReady(issuer)) throw new Error("ISSUER_NOT_READY");
  const supabase = createSupabaseServerClient();

  const { from, to } = monthBounds(yearMonth);
  const lines = (await collectClientBillables(clientId, { from, to }))
    .filter((l) => l.itemType !== "package"); // packages billed at sale, not here

  const invoiceLines  = lines.filter((l) => l.documentKind === "invoice");
  const proformaLines = lines.filter((l) => l.documentKind === "proforma");

  const invoice = invoiceLines.length
    ? await createDocument(supabase, session.stableId, clientId, "invoice", invoiceLines, issuer, from, to)
    : null;
  const proforma = proformaLines.length
    ? await createDocument(supabase, session.stableId, clientId, "proforma", proformaLines, issuer, from, to)
    : null;

  return {
    invoiceId:     invoice?.id ?? null,
    proformaId:    proforma?.id ?? null,
    invoiceTotal:  invoice?.total ?? 0,
    proformaTotal: proforma?.total ?? 0,
  };
}

async function createDocument(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  stableId: string,
  clientId: string,
  kind: "invoice" | "proforma",
  lines: ClientBillable[],
  issuer: Awaited<ReturnType<typeof getStableIssuer>>,
  periodStart: string,
  periodEnd: string,
): Promise<{ id: string; total: number }> {
  const subtotal = Math.round(lines.reduce((a, l) => a + l.amount, 0) * 100) / 100;
  const vat = vatFor(subtotal, issuer.vat_rate);

  const number = kind === "invoice"
    ? await nextInvoiceNumber(supabase, stableId)
    : await nextProformaNumber(supabase, stableId, issuer.invoice_prefix);

  const { data: doc, error: docErr } = await supabase
    .from("invoices")
    .insert({
      stable_id:    stableId,
      client_id:    clientId,
      number,
      kind,
      period_start: periodStart,
      period_end:   periodEnd,
      subtotal,
      vat_rate:     vat.rate,
      vat_amount:   vat.amount,
      total:        vat.total,
      status:       "issued",
    })
    .select("id")
    .single();
  if (docErr || !doc) throw docErr ?? new Error("INSERT_FAILED");
  const id = (doc as { id: string }).id;

  const { error: itemsErr } = await supabase.from("invoice_items").insert(
    lines.map((l, idx) => ({
      invoice_id: id,
      description: l.title,
      quantity:   1,
      unit_price: l.amount,
      line_total: l.amount,
      position:   idx,
      ...sourceFk(l),
    })),
  );
  if (itemsErr) throw itemsErr;

  return { id, total: vat.total };
}

async function nextInvoiceNumber(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  stableId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("next_invoice_number", { p_stable_id: stableId });
  if (error || !data) throw new Error("NUMBERING_FAILED");
  return data as string;
}

/** Proforma numbering — a separate sequence so it never consumes fiscal invoice
 *  numbers. Format: <prefix>-PF-0001. Read-then-increment (fine for a solo owner). */
async function nextProformaNumber(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  stableId: string,
  prefix: string,
): Promise<string> {
  const { data } = await supabase.from("stables").select("next_proforma_seq").eq("id", stableId).single();
  const seq = Number((data as { next_proforma_seq?: number } | null)?.next_proforma_seq ?? 1);
  await supabase.from("stables").update({ next_proforma_seq: seq + 1 }).eq("id", stableId);
  return `${prefix}-PF-${String(seq).padStart(4, "0")}`;
}
