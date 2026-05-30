"use client";

// Invoices list with multi-select + a sticky "Mark paid" bar. Only
// unpaid invoices (issued / overdue) are selectable — paid and cancelled
// rows have their checkbox disabled so you can't no-op them. The bulk
// action flips every selected invoice to "paid" in one round-trip, then
// the server revalidates the list.

import Link from "next/link";
import { useState, useTransition } from "react";
import { bulkMarkInvoicesPaidAction } from "@/app/dashboard/finance/invoices/actions";

type Inv = {
  id:         string;
  number:     string;
  status:     "issued" | "paid" | "overdue" | "cancelled";
  total:      number | string;
  issued_at:  string;
  client:     { id: string; full_name: string } | null;
};

export function InvoiceBulkList({ invoices }: { invoices: Inv[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (invoices.length === 0) {
    return <p className="text-[13px] text-ink-500">No invoices yet.</p>;
  }

  const selectable = invoices.filter((i) => i.status === "issued" || i.status === "overdue");
  const allSelected = selectable.length > 0 && selectable.every((i) => selected.has(i.id));
  const ids = Array.from(selected);
  const selectedTotal = invoices
    .filter((i) => selected.has(i.id))
    .reduce((s, i) => s + Number(i.total), 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setMsg(null);
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectable.map((i) => i.id)));
    setMsg(null);
  }
  function markPaid() {
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await bulkMarkInvoicesPaidAction(ids);
      if (res.error) {
        setMsg(res.error);
      } else {
        setMsg(`${res.updated} invoice${res.updated === 1 ? "" : "s"} marked paid.`);
        setSelected(new Set());
      }
    });
  }

  return (
    <div className="flex flex-col">
      {selectable.length > 0 && (
        <label className="flex items-center gap-2 text-[12px] text-ink-500 pb-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="w-4 h-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30"
          />
          Select all unpaid ({selectable.length})
        </label>
      )}

      <ul className="divide-y divide-ink-100/80">
        {invoices.map((inv) => {
          const canSelect = inv.status === "issued" || inv.status === "overdue";
          return (
            <li key={inv.id} className="flex items-center gap-3">
              <input
                type="checkbox"
                disabled={!canSelect}
                checked={selected.has(inv.id)}
                onChange={() => toggle(inv.id)}
                aria-label={`Select invoice ${inv.number}`}
                className="shrink-0 w-4 h-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30 disabled:opacity-25 disabled:cursor-not-allowed"
              />
              <Link
                href={`/dashboard/finance/invoices/${inv.id}`}
                className="flex-1 min-w-0 py-2.5 flex items-center justify-between gap-3 text-[13px] hover:bg-ink-50/60 -mx-1 px-1 rounded-md transition-colors"
              >
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-ink-900 truncate">{inv.number}</span>
                  <span className="text-ink-500 text-[12px] truncate">
                    {inv.client?.full_name ?? "(client removed)"} ·{" "}
                    {new Date(inv.issued_at).toLocaleDateString("en-GB")}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      inv.status === "paid"
                        ? "bg-emerald-50 text-emerald-700"
                        : inv.status === "overdue"
                        ? "bg-rose-50 text-rose-700"
                        : inv.status === "cancelled"
                        ? "bg-ink-100 text-ink-600"
                        : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {inv.status}
                  </span>
                  <span className="tabular-nums font-semibold text-ink-900">
                    €{Number(inv.total).toFixed(2)}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {msg && <p className="text-[12px] text-ink-500 pt-2">{msg}</p>}

      {ids.length > 0 && (
        <div className="sticky bottom-3 mt-3 z-10 flex items-center justify-between gap-3 rounded-xl bg-navy-700 text-white shadow-lift px-4 py-2.5">
          <span className="text-[13px] font-medium tabular-nums">
            {ids.length} selected · €{selectedTotal.toFixed(2)}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="h-8 px-3 rounded-lg text-[12px] font-medium text-white/85 hover:bg-white/10 transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={markPaid}
              disabled={pending}
              className="h-8 px-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-semibold transition-colors disabled:opacity-60"
            >
              {pending ? "Marking…" : "Mark paid"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
