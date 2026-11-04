"use client";

// Fast credit deduction on the client profile. Lists everything the client
// still owes (delivered lessons, misc charges, boarding months) and lets the
// owner apply the client's account credit — barter included — to any one of
// them in a single tap, without opening each lesson. Each button applies
// exactly min(owed, available); the server recomputes both so a tap can never
// overpay or overspend.

import { useFormState, useFormStatus } from "react-dom";
import { applyCreditToOwedAction, type CreditActionState } from "@/app/dashboard/clients/[id]/credit-actions";
import type { OwedItem } from "@/services/payments";

const initial: CreditActionState = { error: null, success: false };
const eur = (n: number) => `€${n.toFixed(2)}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const KIND_TAG: Record<OwedItem["kind"], string> = {
  lesson:   "Lesson",
  charge:   "Charge",
  boarding: "Boarding",
};

export function CreditApplyPanel({
  clientId,
  items,
  availableCredit,
}: {
  clientId: string;
  items: OwedItem[];
  availableCredit: number;
}) {
  // Nothing to do if there's no credit or nothing owed — the page already
  // guards, but keep the component self-safe.
  if (availableCredit <= 0 || items.length === 0) return null;

  const totalOwed = items.reduce((s, i) => s + i.owed, 0);

  return (
    <div className="bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden">
      <div className="px-5 py-4 border-b border-ink-100 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-navy-900">Spend credit on unpaid items</h3>
          <p className="text-[12.5px] text-ink-500 mt-0.5">
            One tap applies account credit to a lesson, charge or boarding month.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold bg-brand-50 text-brand-700" title="Credit still available to spend">
            {eur(availableCredit)} available
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold bg-amber-50 text-amber-800" title="Total still owed across unpaid items">
            {eur(totalOwed)} owed
          </span>
        </div>
      </div>

      <ul className="divide-y divide-ink-100">
        {items.map((item) => (
          <ItemRow key={`${item.kind}-${item.id}`} clientId={clientId} item={item} availableCredit={availableCredit} />
        ))}
      </ul>
    </div>
  );
}

function ItemRow({
  clientId,
  item,
  availableCredit,
}: {
  clientId: string;
  item: OwedItem;
  availableCredit: number;
}) {
  const [state, action] = useFormState(applyCreditToOwedAction, initial);
  const applyAmount = Math.min(item.owed, availableCredit);
  const partial = applyAmount < item.owed;

  return (
    <li className="px-5 py-3 flex items-center gap-3">
      <div className="w-20 shrink-0 text-[12px] text-ink-500 tabular-nums">{fmtDate(item.occurredAt)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] text-ink-900 truncate">
          <span className="inline-flex items-center mr-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-[0.04em] bg-ink-100 text-ink-600 align-middle">
            {KIND_TAG[item.kind]}
          </span>
          {item.label}
          {item.sub ? <span className="text-ink-500"> · {item.sub}</span> : null}
        </p>
        <p className="text-[12px] text-ink-500 tabular-nums mt-0.5">
          Owes {eur(item.owed)}
          {item.paid > 0 ? <span className="text-ink-400"> · {eur(item.paid)} already paid</span> : null}
        </p>
        {state.error && (
          <p role="alert" className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1 mt-1">{state.error}</p>
        )}
      </div>
      <form action={action} className="shrink-0">
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="kind" value={item.kind} />
        <input type="hidden" name="item_id" value={item.id} />
        <ApplyButton amount={applyAmount} partial={partial} />
      </form>
    </li>
  );
}

function ApplyButton({ amount, partial }: { amount: number; partial: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      title={partial ? "Applies all remaining credit — leaves a balance to settle" : "Pay this item from account credit"}
      className="h-9 px-3.5 rounded-xl text-[13px] font-medium bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 whitespace-nowrap"
    >
      {pending ? "Applying…" : `Use ${eur(amount)}`}
    </button>
  );
}
