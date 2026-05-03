"use client";

// Outstanding boarders board — the answer to tester feedback:
// "boarding labai sunku pazymeti ar sumoketa ... saras privaciu zirgu
// kaip checkpointai, kaip reminders, paspaust ant tos eilutes ... kai
// pspaudzia perklaustu appsas ar tikrai sumokejo."
//
// Click any row → confirm dialog ("Mark Storm's April boarding paid?
// €380 by [Cash/Card/Transfer]"). Confirm → server action settles the
// charge by inserting a payment row equal to the remaining balance.
//
// Already-paid (or partial-once-fully-paid) charges drop from this
// list; they live on the horse profile boarding tab.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  markBoardingPaidAction,
} from "@/app/dashboard/settings/boarding/mark-paid-action";
import type { OutstandingBoardingRow } from "@/services/boarding";

const FMT_EUR = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "EUR",
});

export function OutstandingBoardingBoard({
  rows,
}: {
  rows: OutstandingBoardingRow[];
}) {
  const [pendingRow, setPendingRow] = useState<OutstandingBoardingRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <section className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3">
        <span
          aria-hidden
          className="w-9 h-9 rounded-xl bg-emerald-600 text-white inline-flex items-center justify-center text-sm"
        >
          ✓
        </span>
        <div>
          <p className="text-sm font-semibold text-emerald-900">All boarders paid up</p>
          <p className="text-[12.5px] text-emerald-800/80">
            No outstanding boarding charges. Generate next month's charges below when ready.
          </p>
        </div>
      </section>
    );
  }

  const total = rows.reduce(
    (acc, r) => acc + (r.amount - r.paid_amount),
    0,
  );

  function confirmAndMarkPaid(method: "cash" | "card" | "transfer" | "other") {
    if (!pendingRow) return;
    const fd = new FormData();
    fd.set("charge_id", pendingRow.id);
    fd.set("method", method);
    setError(null);
    startTransition(async () => {
      const res = await markBoardingPaidAction({ ok: false, error: null }, fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPendingRow(null);
      router.refresh();
    });
  }

  return (
    <section className="bg-white rounded-2xl shadow-soft overflow-hidden">
      <header className="px-5 py-4 border-b border-ink-100 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-navy-900">Outstanding boarders</h3>
          <p className="text-[12px] text-ink-500 mt-0.5">
            Click any row to mark paid. Total owed:{" "}
            <span className="font-semibold text-navy-900 tabular-nums">{FMT_EUR.format(total)}</span>
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-rose-700 bg-rose-50 px-2 py-1 rounded-md">
          {rows.length} unpaid
        </span>
      </header>

      <ul className="divide-y divide-ink-100">
        {rows.map((r) => {
          const remaining = r.amount - r.paid_amount;
          const tone =
            r.payment_status === "partial"
              ? "bg-amber-50/40 hover:bg-amber-50"
              : "bg-rose-50/30 hover:bg-rose-50/60";
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => { setPendingRow(r); setError(null); }}
                className={`
                  w-full text-left px-5 py-3.5 flex items-center gap-3
                  ${tone} transition-colors
                `}
              >
                <span
                  className={`
                    shrink-0 w-2.5 h-2.5 rounded-full
                    ${r.payment_status === "partial" ? "bg-amber-500" : "bg-rose-500"}
                  `}
                  aria-hidden
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy-900 truncate">
                    {r.horse_name}
                    <span className="text-ink-400 font-normal"> · </span>
                    <span className="text-ink-700 font-normal">{r.owner_client_name}</span>
                  </p>
                  <p className="text-[11.5px] text-ink-500">
                    {r.period_label ?? r.period_start}
                    {r.payment_status === "partial" && (
                      <span className="text-amber-700"> · partially paid</span>
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums text-navy-900">
                    {FMT_EUR.format(remaining)}
                  </p>
                  <p className="text-[11px] text-ink-500">
                    of {FMT_EUR.format(r.amount)}
                  </p>
                </div>
                <span className="text-ink-300 ml-1" aria-hidden>→</span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Confirm dialog */}
      {pendingRow && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-40 flex items-center justify-center px-4 bg-navy-900/40 backdrop-blur-sm"
          onClick={() => !busy && setPendingRow(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-lift max-w-sm w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-3">
              <h4 className="text-base font-semibold text-navy-900">
                Mark boarding paid?
              </h4>
              <p className="text-[13px] text-ink-700 mt-2 leading-relaxed">
                <span className="font-semibold">{pendingRow.horse_name}</span>
                {" · "}
                <span>{pendingRow.owner_client_name}</span>
                <br />
                <span className="text-ink-500">
                  {pendingRow.period_label ?? pendingRow.period_start}
                </span>
                <br />
                Amount due:{" "}
                <span className="font-semibold tabular-nums text-navy-900">
                  {FMT_EUR.format(pendingRow.amount - pendingRow.paid_amount)}
                </span>
              </p>
              <p className="text-[12px] text-ink-500 mt-3">
                Pick a method. The payment is recorded under <span className="text-ink-700 font-medium">{pendingRow.owner_client_name}</span>'s account.
              </p>
              {error && (
                <p className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mt-3" role="alert">
                  {error}
                </p>
              )}
            </div>

            <div className="px-5 py-4 border-t border-ink-100 grid grid-cols-2 gap-2">
              <PaymentMethodButton onClick={() => confirmAndMarkPaid("cash")}     label="Cash"     busy={busy} />
              <PaymentMethodButton onClick={() => confirmAndMarkPaid("card")}     label="Card"     busy={busy} />
              <PaymentMethodButton onClick={() => confirmAndMarkPaid("transfer")} label="Transfer" busy={busy} />
              <PaymentMethodButton onClick={() => confirmAndMarkPaid("other")}    label="Other"    busy={busy} />
            </div>

            <div className="px-5 py-3 border-t border-ink-100 flex justify-between items-center bg-surface/40">
              <Link
                href={`/dashboard/horses/${pendingRow.horse_id}?tab=boarding`}
                className="text-[12px] text-ink-500 hover:text-ink-900"
                onClick={() => setPendingRow(null)}
              >
                Open horse →
              </Link>
              <button
                type="button"
                onClick={() => setPendingRow(null)}
                disabled={busy}
                className="text-[12px] text-ink-500 hover:text-ink-900"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function PaymentMethodButton({
  onClick,
  label,
  busy,
}: {
  onClick: () => void;
  label: string;
  busy: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="
        h-10 px-3 rounded-xl text-sm font-medium
        bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800
        disabled:opacity-60 transition-colors
      "
    >
      {busy ? "…" : label}
    </button>
  );
}
