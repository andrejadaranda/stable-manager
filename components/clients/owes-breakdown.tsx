"use client";

import { useState, useTransition } from "react";
import { markOwedPaidAction } from "@/app/dashboard/clients/[id]/owes-actions";
import type { OwedItem } from "@/services/payments";

type Props = {
  clientId: string;
  items: OwedItem[];
  /** Total owed surfaced in the Balance card above — passed in so we
   *  can sanity-check (and surface a small note) when the sum of
   *  breakdown lines doesn't match. They should always match, but a
   *  partial-payment edge case is worth catching. */
  totalOwedFromBalance: number;
};

/**
 * "What does this client actually owe for?" panel.
 *
 * Shows every unpaid item — lessons, misc charges, boarding fees — in
 * a single oldest-first timeline with an inline Mark paid button on
 * each row. Owner-only (the parent gates rendering by role).
 *
 * UX choices:
 *   * One button per line — no select-checkbox+bulk-action UX; the
 *     common case is "I just collected cash for that lesson," not
 *     "process 12 things at once." Bulk can come later when there's
 *     real demand.
 *   * Method defaults to cash — fastest path for the owner-walks-up
 *     case. A small "More" link can expand a method picker per row
 *     (kept inline so it doesn't shift other rows).
 *   * Optimistic loading state via useTransition — the row dims and
 *     swaps to "Marking…" while the server action runs, then the
 *     server-side revalidate snaps the whole panel to its new state.
 */
export function OwesBreakdown({ clientId, items, totalOwedFromBalance }: Props) {
  const subtotal = items.reduce((s, i) => s + i.owed, 0);

  if (items.length === 0) {
    return (
      <section className="bg-white rounded-2xl shadow-soft p-5">
        <h2 className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-500">
          Owes breakdown
        </h2>
        <p className="mt-2 text-sm text-neutral-500">
          Nothing outstanding. Every lesson, charge, and boarding fee
          is settled.
        </p>
      </section>
    );
  }

  // Sanity hint when sums diverge (e.g. legacy credit on the account
  // that pulls the balance below the line-item sum). Visible only in
  // the rare mismatched case — not noise.
  const diff = Math.round((subtotal - totalOwedFromBalance) * 100) / 100;
  const hasMismatch = Math.abs(diff) > 0.01;

  return (
    <section className="bg-white rounded-2xl shadow-soft p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-500">
          Owes breakdown
        </h2>
        <p className="text-sm font-semibold text-red-700 tabular-nums">
          {fmtMoney(subtotal)}
        </p>
      </div>

      <ul className="mt-3 divide-y divide-neutral-100">
        {items.map((item) => (
          <OwedRow
            key={`${item.kind}:${item.id}`}
            item={item}
            clientId={clientId}
          />
        ))}
      </ul>

      {hasMismatch && (
        <p className="mt-3 text-[11px] text-neutral-500">
          Note: the balance card above shows {fmtMoney(totalOwedFromBalance)},
          which differs from the line-item total by {fmtMoney(Math.abs(diff))}
          — usually a prepayment/credit on the account.
        </p>
      )}
    </section>
  );
}

function OwedRow({
  item,
  clientId,
}: {
  item: OwedItem;
  clientId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError]          = useState<string | null>(null);
  const [showMethods, setShowMethods] = useState(false);

  function markPaid(method: "cash" | "card" | "transfer") {
    setError(null);
    const fd = new FormData();
    fd.set("kind", item.kind);
    fd.set("item_id", item.id);
    fd.set("client_id", clientId);
    fd.set("method", method);
    startTransition(async () => {
      const res = await markOwedPaidAction({ error: null, success: false }, fd);
      if (res.error) setError(res.error);
    });
  }

  return (
    <li className="py-3 first:pt-1 last:pb-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-neutral-500">
              <KindDot kind={item.kind} />
              {KIND_LABEL[item.kind]}
            </span>
            <span className="text-sm font-medium text-neutral-900">
              {item.label}
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5 truncate">
            {item.sub
              ? `${formatDateLabel(item.occurredAt)} · ${item.sub}`
              : formatDateLabel(item.occurredAt)}
            {item.paid > 0 && (
              <span className="ml-1.5 text-neutral-400">
                · {fmtMoney(item.paid)} of {fmtMoney(item.amount)} paid
              </span>
            )}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold tabular-nums text-neutral-900">
            {fmtMoney(item.owed)}
          </p>
          <div className="mt-1 flex items-center gap-1 justify-end">
            <button
              type="button"
              disabled={pending}
              onClick={() => markPaid("cash")}
              className="text-xs font-medium px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
            >
              {pending ? "Marking…" : "Mark paid"}
            </button>
            <button
              type="button"
              onClick={() => setShowMethods((v) => !v)}
              disabled={pending}
              aria-label="Choose payment method"
              className="text-xs px-1.5 py-1 rounded border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
            >
              ▾
            </button>
          </div>
          {showMethods && (
            <div className="mt-1 flex gap-1 justify-end">
              <MethodButton label="Card" onClick={() => { setShowMethods(false); markPaid("card"); }} disabled={pending} />
              <MethodButton label="Transfer" onClick={() => { setShowMethods(false); markPaid("transfer"); }} disabled={pending} />
            </div>
          )}
        </div>
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
          {error}
        </p>
      )}
    </li>
  );
}

function MethodButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="text-[11px] px-2 py-0.5 rounded border border-neutral-200 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function KindDot({ kind }: { kind: OwedItem["kind"] }) {
  const color =
    kind === "lesson"   ? "bg-sky-500"   :
    kind === "charge"   ? "bg-amber-500" :
                          "bg-violet-500";
  return <span className={`w-1.5 h-1.5 rounded-full ${color}`} aria-hidden />;
}

const KIND_LABEL: Record<OwedItem["kind"], string> = {
  lesson:   "Lesson",
  charge:   "Charge",
  boarding: "Boarding",
};

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

function formatDateLabel(iso: string): string {
  // Accept both "2026-05-22" and "2026-05-22T14:00:00Z"
  const dateOnly = iso.length === 10 ? `${iso}T00:00:00Z` : iso;
  const d = new Date(dateOnly);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
