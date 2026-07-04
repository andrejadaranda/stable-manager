"use client";

// Owner-only boarding rate presets manager. Lets a stable define several
// named monthly prices (Full board, Part board, Pasture…) so the per-horse
// fee + boarding charges can be filled with one tap instead of retyping.

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  createRateAction,
  updateRateAction,
  deleteRateAction,
  type RateActionState,
} from "@/app/dashboard/settings/boarding/rate-actions";
import type { BoardingRateRow } from "@/services/boardingRates";

const initialState: RateActionState = { error: null, success: false };

const FMT_EUR = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "EUR",
});

const INPUT =
  "rounded-xl border border-ink-200 bg-white text-sm text-ink-900 placeholder:text-ink-400 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500";

export function BoardingRatesManager({ rates }: { rates: BoardingRateRow[] }) {
  return (
    <section className="bg-white rounded-2xl shadow-soft p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-navy-900">Boarding price options</h3>
        <p className="text-[11.5px] text-ink-500 mt-0.5">
          Define your standard monthly boarding tiers. Pick one per horse to fill
          the fee in a tap — e.g. Full board €350, Pasture €150. Removing a tier
          only affects future fills — it doesn&apos;t change fees or charges already set.
        </p>
      </div>

      <CreateRateForm />

      {rates.length === 0 ? (
        <p className="text-[13px] text-ink-500">No price options yet. Add your first above.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rates.map((r) => (
            <RateRow key={r.id} rate={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CreateRateForm() {
  const [state, action] = useFormState<RateActionState, FormData>(createRateAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.success) formRef.current?.reset(); }, [state.success]);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-end gap-2.5">
      <label className="flex flex-col gap-1 text-sm flex-1 min-w-[10rem]">
        <span className="text-[11px] uppercase tracking-wider text-ink-500 font-medium">Name</span>
        <input name="name" required placeholder="e.g. Full board" className={INPUT} />
      </label>
      <label className="flex flex-col gap-1 text-sm w-32">
        <span className="text-[11px] uppercase tracking-wider text-ink-500 font-medium">Amount · €</span>
        <input name="amount" type="number" min="0" step="0.01" required placeholder="350" className={INPUT} />
      </label>
      <AddButton />
      {state.error && <p className="w-full text-[11px] text-rose-700">{state.error}</p>}
    </form>
  );
}

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-[42px] px-4 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Adding…" : "Add"}
    </button>
  );
}

function RateRow({ rate }: { rate: BoardingRateRow }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <EditRateForm rate={rate} onClose={() => setEditing(false)} />;
  return (
    <li className="flex items-center gap-3 rounded-xl border border-ink-100 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-navy-900 truncate">
          {rate.name}
          {!rate.active && (
            <span className="ml-2 text-[10px] uppercase tracking-[0.14em] text-ink-400 font-semibold">Inactive</span>
          )}
        </p>
        <p className="text-[12px] text-ink-500 tabular-nums">{FMT_EUR.format(Number(rate.amount))} / month</p>
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="h-9 px-3 rounded-xl text-xs font-medium text-ink-700 hover:bg-ink-100/60"
      >
        Edit
      </button>
      <DeleteRateButton rateId={rate.id} />
    </li>
  );
}

function EditRateForm({ rate, onClose }: { rate: BoardingRateRow; onClose: () => void }) {
  const [state, action] = useFormState<RateActionState, FormData>(updateRateAction, initialState);
  const [active, setActive] = useState(rate.active);
  useEffect(() => { if (state.success) onClose(); }, [state.success, onClose]);
  return (
    <li>
      <form action={action} className="flex flex-wrap items-end gap-2.5 rounded-xl border border-ink-200 bg-cream-50/60 p-3">
        <input type="hidden" name="rate_id" value={rate.id} />
        <input type="hidden" name="active" value={String(active)} />
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-[10rem]">
          <span className="text-[11px] uppercase tracking-wider text-ink-500 font-medium">Name</span>
          <input name="name" required defaultValue={rate.name} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1 text-sm w-28">
          <span className="text-[11px] uppercase tracking-wider text-ink-500 font-medium">Amount · €</span>
          <input name="amount" type="number" min="0" step="0.01" required defaultValue={Number(rate.amount).toFixed(2)} className={INPUT} />
        </label>
        <label className="flex items-center gap-2 text-[13px] text-ink-700 cursor-pointer select-none h-[42px]">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30" />
          Active
        </label>
        <SaveButton />
        <button type="button" onClick={onClose} className="h-[42px] px-3 rounded-xl text-sm text-ink-700 hover:bg-ink-100/60">Cancel</button>
        {state.error && <p className="w-full text-[11px] text-rose-700">{state.error}</p>}
      </form>
    </li>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="h-[42px] px-4 rounded-xl bg-navy-900 text-white text-sm font-medium hover:bg-navy-800 disabled:opacity-60">
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

function DeleteRateButton({ rateId }: { rateId: string }) {
  const [, action] = useFormState<RateActionState, FormData>(deleteRateAction, initialState);
  return (
    <form action={action}>
      <input type="hidden" name="rate_id" value={rateId} />
      <DeleteSubmit />
    </form>
  );
}

function DeleteSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => { if (!confirm("Delete this price option?")) e.preventDefault(); }}
      className="h-9 px-2 rounded-xl text-[11px] text-ink-500 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-50"
    >
      {pending ? "…" : "Delete"}
    </button>
  );
}
