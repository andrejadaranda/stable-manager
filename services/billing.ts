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

/** First and last calendar day of a "YYYY-MM" month, as YYYY-MM-DD strings. */
export function monthBounds(yearMonth: string): { from: string; to: string } {
  const [y, m] = yearMonth.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const last = new Date(Date.UTC(y, m, 0)); // day 0 of next month = last day
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(first), to: iso(last) };
}
