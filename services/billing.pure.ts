// Shared, runtime-free types for the unified billing layer. Every finance
// feature (forecast, consolidated invoice, faktūra/proforma, Smart Intake)
// speaks in BillableItem — one normalized shape over lessons, boarding, misc
// client charges and packages. Kept in a `.pure` file so "use client"
// components can import the types without pulling in the server client.

export type BillableItemType = "lesson" | "boarding" | "charge" | "package";

// The status state machine. `scheduled -> delivered` happens automatically as
// the occurrence date passes; `-> paid` as payments cover the amount. Lines are
// never deleted — only `cancelled` / `refunded`. (`refunded` is reserved for a
// later stage; the view does not emit it yet.)
export type BillableStatus =
  | "scheduled"
  | "delivered"
  | "paid"
  | "cancelled"
  | "refunded";

export type BillableItem = {
  itemType: BillableItemType;
  sourceId: string;        // id of the underlying row (lesson/boarding/charge/package)
  stableId: string;
  clientId: string;        // the payer
  horseId: string | null;
  title: string;
  amount: number;          // total owed for this item
  paidAmount: number;      // sum of payments applied so far
  remaining: number;       // max(amount - paidAmount, 0) — partial balance (Variant 1)
  occursOn: string;        // YYYY-MM-DD (lesson day / boarding period start / charge date)
  isReimbursement: boolean;// farrier/vet/etc — nets against expenses, not revenue
  status: BillableStatus;
  invoiced: boolean;       // already appears on an invoice (dedupe guard)
};

export const BILLABLE_STATUS_LABEL: Record<BillableStatus, string> = {
  scheduled: "Scheduled",
  delivered: "Delivered",
  paid: "Paid",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export const BILLABLE_TYPE_LABEL: Record<BillableItemType, string> = {
  lesson: "Lesson",
  boarding: "Boarding",
  charge: "Charge",
  package: "Package",
};

/** A scheduled/delivered item that still has money outstanding counts toward
 *  "pending"/"projected" income; paid/cancelled do not. */
export function isOutstanding(item: BillableItem): boolean {
  return (
    (item.status === "scheduled" || item.status === "delivered") &&
    item.remaining > 0 &&
    !item.isReimbursement
  );
}
