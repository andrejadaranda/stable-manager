// Unified billing reader — the single entry point every finance feature uses
// to read money owed/paid across all sources. Backed by the `billable_items`
// SQL view (security_invoker, so tenant RLS applies automatically).
//
// This is the Stage-1 core. Later stages add: forecast aggregation (D),
// consolidated invoice collection (B), faktūra/proforma (C), Smart Intake (A) —
// all of them consume BillableItem instead of touching the 4 source tables.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import type { BillableItem, BillableStatus, BillableItemType } from "./billing.pure";

export type { BillableItem, BillableStatus, BillableItemType } from "./billing.pure";

type BillableRow = {
  item_type: BillableItemType;
  source_id: string;
  stable_id: string;
  client_id: string;
  horse_id: string | null;
  title: string;
  amount: number | string;
  paid_amount: number | string;
  occurs_on: string;
  is_reimbursement: boolean;
  status: BillableStatus;
  invoiced: boolean;
};

function mapRow(r: BillableRow): BillableItem {
  const amount = Number(r.amount);
  const paidAmount = Number(r.paid_amount);
  return {
    itemType: r.item_type,
    sourceId: r.source_id,
    stableId: r.stable_id,
    clientId: r.client_id,
    horseId: r.horse_id,
    title: r.title,
    amount,
    paidAmount,
    remaining: Math.max(amount - paidAmount, 0),
    occursOn: r.occurs_on,
    isReimbursement: r.is_reimbursement,
    status: r.status,
    invoiced: r.invoiced,
  };
}

export type BillableFilter = {
  clientId?: string;
  /** inclusive YYYY-MM-DD lower bound on occurs_on */
  from?: string;
  /** inclusive YYYY-MM-DD upper bound on occurs_on */
  to?: string;
  statuses?: BillableStatus[];
  itemTypes?: BillableItemType[];
};

/**
 * List billable items visible to the caller. RLS (via the security_invoker
 * view) already scopes rows to the caller's stable, and clients to their own
 * data — so this is safe for any authenticated role.
 */
export async function listBillableItems(filter: BillableFilter = {}): Promise<BillableItem[]> {
  await getSession();
  const supabase = createSupabaseServerClient();

  let q = supabase
    .from("billable_items")
    .select("item_type, source_id, stable_id, client_id, horse_id, title, amount, paid_amount, occurs_on, is_reimbursement, status, invoiced");

  if (filter.clientId) q = q.eq("client_id", filter.clientId);
  if (filter.from) q = q.gte("occurs_on", filter.from);
  if (filter.to) q = q.lte("occurs_on", filter.to);
  if (filter.statuses?.length) q = q.in("status", filter.statuses);
  if (filter.itemTypes?.length) q = q.in("item_type", filter.itemTypes);

  const { data, error } = await q.order("occurs_on", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as BillableRow[]).map(mapRow);
}

/** Every billable item for one client (all time). */
export async function getClientBillableItems(clientId: string): Promise<BillableItem[]> {
  return listBillableItems({ clientId });
}

/** Every billable item whose occurrence date falls in the given month. */
export async function getMonthBillableItems(
  yearMonth: string,             // "YYYY-MM"
  clientId?: string,
): Promise<BillableItem[]> {
  const { from, to } = monthBounds(yearMonth);
  return listBillableItems({ from, to, clientId });
}

// ---------------------------------------------------------------------------
// Income forecast (Stage D). Three live numbers for a month, all reading the
// same billable_items view — so they move automatically as lessons are booked,
// delivered and paid. No "recalculate" button: recomputed on every page load.
// Reimbursements (farrier/vet/etc) are excluded — they offset expenses, not
// income.
// ---------------------------------------------------------------------------
export type MonthForecast = {
  received: number;   // already collected against this month's items
  pending: number;    // delivered but not fully paid — owed now
  projected: number;  // scheduled (future this month) and not yet paid — still coming
  expected: number;   // received + pending + projected
};

export async function getMonthForecast(
  yearMonth: string,
  clientId?: string,
): Promise<MonthForecast> {
  const items = (await getMonthBillableItems(yearMonth, clientId)).filter(
    (i) => !i.isReimbursement && i.status !== "cancelled" && i.status !== "refunded",
  );

  let received = 0;
  let pending = 0;
  let projected = 0;
  for (const i of items) {
    received += i.paidAmount;
    if (i.remaining > 0) {
      if (i.status === "scheduled") projected += i.remaining;
      else pending += i.remaining; // delivered / paid-but-short
    }
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    received: round(received),
    pending: round(pending),
    projected: round(projected),
    expected: round(received + pending + projected),
  };
}

// ---------------------------------------------------------------------------
// Consolidated monthly bill (Stage B). Everything owed by / paid by ONE person
// in a period, from EVERY source — lessons, boarding, farrier/vet/misc — plus
// future scheduled lessons. Each line is tagged as belonging to a real invoice
// (faktūra: already delivered/paid) or a proforma (išankstinė: future,
// not-yet-delivered). Already-invoiced and cancelled lines are excluded so
// nothing is billed twice. This is the read-only collection layer; Stage C
// turns these buckets into actual documents.
// ---------------------------------------------------------------------------
export type DocumentKind = "invoice" | "proforma";

export type ClientBillable = BillableItem & { documentKind: DocumentKind };

export type MonthlyBillBucket = {
  lines: ClientBillable[];
  subtotal: number; // sum of amounts (pre-VAT)
};

export type MonthlyBillPreview = {
  clientId: string;
  from: string;
  to: string;
  invoice: MonthlyBillBucket;   // delivered / paid — belongs on the faktūra
  proforma: MonthlyBillBucket;  // future scheduled — belongs on the išankstinė
  grandTotal: number;
};

/** Future (not-yet-delivered) items go on a proforma; everything already
 *  delivered or paid goes on the real invoice. */
function documentKindFor(item: BillableItem): DocumentKind {
  return item.status === "scheduled" ? "proforma" : "invoice";
}

/**
 * Every billable line for one client in [from, to] that is not already on an
 * invoice and not cancelled/refunded — tagged invoice vs proforma. Includes
 * reimbursement charges (farrier/vet are legitimate lines on a CLIENT bill),
 * unlike the income forecast which excludes them.
 */
export async function collectClientBillables(
  clientId: string,
  range: { from: string; to: string },
): Promise<ClientBillable[]> {
  const items = await listBillableItems({ clientId, from: range.from, to: range.to });
  return items
    .filter((i) => !i.invoiced && i.status !== "cancelled" && i.status !== "refunded")
    .map((i) => ({ ...i, documentKind: documentKindFor(i) }));
}

/** Consolidated preview for one client's month, split into faktūra + proforma. */
export async function previewClientMonthlyBill(
  clientId: string,
  yearMonth: string,
): Promise<MonthlyBillPreview> {
  const { from, to } = monthBounds(yearMonth);
  const lines = await collectClientBillables(clientId, { from, to });

  const invoiceLines = lines.filter((l) => l.documentKind === "invoice");
  const proformaLines = lines.filter((l) => l.documentKind === "proforma");
  const sum = (xs: ClientBillable[]) => Math.round(xs.reduce((a, x) => a + x.amount, 0) * 100) / 100;

  return {
    clientId,
    from,
    to,
    invoice: { lines: invoiceLines, subtotal: sum(invoiceLines) },
    proforma: { lines: proformaLines, subtotal: sum(proformaLines) },
    grandTotal: sum(lines),
  };
}

/** First and last calendar day of a "YYYY-MM" month, as YYYY-MM-DD strings. */
export function monthBounds(yearMonth: string): { from: string; to: string } {
  const [y, m] = yearMonth.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const last = new Date(Date.UTC(y, m, 0)); // day 0 of next month = last day
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(first), to: iso(last) };
}
