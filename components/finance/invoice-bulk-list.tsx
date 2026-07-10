"use client";

// Invoices list — status-striped cards + multi-select "Mark paid".
// Only unpaid invoices (issued / overdue) are selectable; a small checkbox
// appears on those rows and the sticky bar flips them all to paid in one
// round-trip. A summary strip (outstanding / paid / count) sits on top,
// computed from the same rows.

import Link from "next/link";
import { useState, useTransition } from "react";
import { bulkMarkInvoicesPaidAction } from "@/app/dashboard/finance/invoices/actions";

type Status = "issued" | "paid" | "overdue" | "cancelled";
type Inv = {
  id:         string;
  number:     string;
  status:     Status;
  total:      number | string;
  issued_at:  string;
  client:     { id: string; full_name: string } | null;
};

const STRIPE: Record<Status, string> = {
  issued:    "bg-amber-500",
  overdue:   "bg-alert-500",
  paid:      "bg-brand-500",
  cancelled: "bg-ink-300",
};
const BADGE: Record<Status, string> = {
  issued:    "bg-amber-50 text-amber-800",
  overdue:   "bg-alert-100 text-alert-700",
  paid:      "bg-brand-50 text-brand-700",
  cancelled: "bg-ink-100 text-ink-500",
};
const STATUS_LABEL: Record<Status, string> = {
  issued: "Issued", overdue: "Overdue", paid: "Paid", cancelled: "Cancelled",
};

export function InvoiceBulkList({ invoices }: { invoices: Inv[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (invoices.length === 0) {
    return <p className="text-[13px] text-ink-500">No invoices yet.</p>;
  }

  const selectable = invoices.filter((i) => i.status === "issued" || i.status === "overdue");
  const ids = Array.from(selected);
  const selectedTotal = invoices.filter((i) => selected.has(i.id)).reduce((s, i) => s + Number(i.total), 0);

  const outstanding = selectable.reduce((s, i) => s + Number(i.total), 0);
  const paidRows = invoices.filter((i) => i.status === "paid");
  const paidTotal = paidRows.reduce((s, i) => s + Number(i.total), 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setMsg(null);
  }
  function markPaid() {
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await bulkMarkInvoicesPaidAction(ids);
      if (res.error) setMsg(res.error);
      else { setMsg(`${res.updated} invoice${res.updated === 1 ? "" : "s"} marked paid.`); setSelected(new Set()); }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <SumCell value={`€${outstanding.toFixed(0)}`} label={`Outstanding · ${selectable.length}`} tone="alert" />
        <SumCell value={`€${paidTotal.toFixed(0)}`} label={`Paid · ${paidRows.length}`} tone="brand" />
        <SumCell value={String(invoices.length)} label="Total" tone="ink" />
      </div>

      {msg && <p className="text-[12px] text-ink-500">{msg}</p>}

      <ul className="flex flex-col gap-2.5">
        {invoices.map((inv) => {
          const canSelect = inv.status === "issued" || inv.status === "overdue";
          const cancelled = inv.status === "cancelled";
          return (
            <li key={inv.id} className="flex items-stretch gap-2">
              {canSelect && (
                <label className="flex items-center shrink-0 pl-0.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(inv.id)}
                    onChange={() => toggle(inv.id)}
                    aria-label={`Select invoice ${inv.number}`}
                    className="w-[18px] h-[18px] rounded-md border-ink-300 text-brand-600 focus:ring-brand-500/30"
                  />
                </label>
              )}
              <Link
                href={`/dashboard/finance/invoices/${inv.id}`}
                className="flex-1 min-w-0 flex items-stretch bg-white border border-ink-100 rounded-2xl shadow-soft overflow-hidden active:scale-[0.995] transition-transform"
              >
                <span className={`w-1.5 shrink-0 ${STRIPE[inv.status]}`} />
                <div className="flex-1 min-w-0 px-3.5 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-bold text-[15px] text-ink-900 truncate">{inv.number}</span>
                    <span className={`font-mono font-semibold text-[15px] tabular-nums shrink-0 ${cancelled ? "text-ink-400 line-through" : "text-ink-900"}`}>
                      €{Number(inv.total).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="text-[13px] text-ink-500 truncate">
                      {inv.client?.full_name ?? "(client removed)"} · {new Date(inv.issued_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/Vilnius" })}
                    </span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${BADGE[inv.status]}`}>
                      {STATUS_LABEL[inv.status]}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {ids.length > 0 && (
        <div className="sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-2xl bg-brand-700 text-white shadow-lift px-4 py-3">
          <span className="text-[13px] font-semibold tabular-nums">
            {ids.length} selected · €{selectedTotal.toFixed(2)}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setSelected(new Set())} className="h-9 px-3 rounded-xl text-[12px] font-medium text-white/85 hover:bg-white/10 transition-colors">
              Clear
            </button>
            <button type="button" onClick={markPaid} disabled={pending} className="h-9 px-4 rounded-xl bg-white text-brand-800 text-[12px] font-bold hover:bg-brand-50 transition-colors disabled:opacity-60">
              {pending ? "Marking…" : "Mark paid"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SumCell({ value, label, tone }: { value: string; label: string; tone: "alert" | "brand" | "ink" }) {
  const valueCls = tone === "alert" ? "text-alert-700" : tone === "brand" ? "text-brand-700" : "text-ink-900";
  return (
    <div className="bg-white border border-ink-100 rounded-2xl shadow-soft p-3.5 text-center">
      <div className={`font-mono font-semibold text-[20px] tabular-nums ${valueCls}`}>{value}</div>
      <div className="text-[11px] text-ink-500 mt-1 truncate">{label}</div>
    </div>
  );
}
