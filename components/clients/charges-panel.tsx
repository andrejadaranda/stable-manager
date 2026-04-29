"use client";

// Misc charges panel — used on:
//   * Client detail (`charges` tab on the client page)
//   * Horse profile Boarding tab (when horse has an owner client)
//
// Owner-only writes; the row tone + Mark paid / Mark unpaid pattern
// mirrors the boarding-charge flow so the muscle memory transfers.

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  createChargeAction,
  deleteChargeAction,
  markPaidAction,
  markUnpaidAction,
  type ChargeActionState,
} from "@/app/dashboard/clients/[id]/charge-actions";
import type { ClientChargeRow, ClientChargeKind } from "@/services/clientCharges";

const initialState: ChargeActionState = { error: null, success: false };

const FMT_EUR = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "EUR",
});

const KIND_LABEL: Record<ClientChargeKind, string> = {
  farrier:        "Farrier",
  equipment:      "Equipment",
  supplement:     "Supplement / feed",
  vet_copay:      "Vet co-pay",
  transport:      "Transport",
  training_extra: "Extra training",
  other:          "Other",
};

const KIND_TONE: Record<ClientChargeKind, string> = {
  farrier:        "bg-violet-50 text-violet-700",
  equipment:      "bg-amber-50 text-amber-700",
  supplement:     "bg-emerald-50 text-emerald-700",
  vet_copay:      "bg-rose-50 text-rose-700",
  transport:      "bg-sky-50 text-sky-700",
  training_extra: "bg-brand-50 text-brand-700",
  other:          "bg-ink-100 text-ink-700",
};

export function ChargesPanel({
  clientId,
  charges,
  horseId,
  isOwner,
  /** When the panel is rendered from a horse profile, hide the panel
   *  title (the host already provides one). */
  bare = false,
}: {
  clientId: string;
  charges: ClientChargeRow[];
  /** When set, the inline Add form pre-fills horse_id (and the panel
   *  filters to charges for this horse only — already done by caller). */
  horseId?: string;
  isOwner: boolean;
  bare?: boolean;
}) {
  const totalDue = charges.reduce((acc, c) => {
    const remaining = Math.max(0, Number(c.amount) - Number(c.paid_amount));
    return acc + remaining;
  }, 0);

  const Wrapper = bare ? Bare : Card;

  return (
    <Wrapper>
      {!bare && (
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-sm font-semibold text-navy-900">Other charges</h2>
            <p className="text-[11.5px] text-ink-500 mt-0.5">
              Farrier, equipment, supplements — anything outside lessons +
              packages + boarding.
            </p>
          </div>
          <p className={`text-sm font-semibold tabular-nums ${totalDue > 0 ? "text-amber-700" : "text-emerald-700"}`}>
            {totalDue > 0 ? `${FMT_EUR.format(totalDue)} due` : "All settled"}
          </p>
        </div>
      )}

      {isOwner && (
        <CreateInline clientId={clientId} horseId={horseId} />
      )}

      {charges.length === 0 ? (
        <p className="text-sm text-ink-500">Nothing recorded.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {charges.map((c) => (
            <ChargeRow
              key={c.id}
              charge={c}
              clientId={clientId}
              isOwner={isOwner}
            />
          ))}
        </ul>
      )}
    </Wrapper>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl shadow-soft p-5 flex flex-col gap-4">
      {children}
    </section>
  );
}

function Bare({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

// =============================================================
// Create inline
// =============================================================
function CreateInline({
  clientId,
  horseId,
}: {
  clientId: string;
  horseId?: string;
}) {
  const [state, action] = useFormState<ChargeActionState, FormData>(
    createChargeAction,
    initialState,
  );
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ClientChargeKind>("farrier");

  useEffect(() => { if (state.success) setOpen(false); }, [state.success]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="
          self-start h-9 px-3 rounded-xl text-[12.5px] font-medium
          bg-brand-50 text-brand-700 hover:bg-brand-100
          transition-colors
        "
      >
        + Add charge
      </button>
    );
  }

  return (
    <form
      action={action}
      className="rounded-xl border border-ink-100 bg-surface p-3 flex flex-col gap-3"
    >
      <input type="hidden" name="client_id" value={clientId} />
      {horseId && <input type="hidden" name="horse_id" value={horseId} />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="flex flex-col gap-1.5 text-sm sm:col-span-1">
          <span className="text-[11.5px] uppercase tracking-[0.04em] font-medium text-ink-500">Type</span>
          <select
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as ClientChargeKind)}
            className="
              rounded-xl border border-ink-200 bg-white text-sm text-ink-900
              px-3 py-2.5
              focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
            "
          >
            {(Object.keys(KIND_LABEL) as ClientChargeKind[]).map((k) => (
              <option key={k} value={k}>{KIND_LABEL[k]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm sm:col-span-1">
          <span className="text-[11.5px] uppercase tracking-[0.04em] font-medium text-ink-500">Amount · €</span>
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            className="
              rounded-xl border border-ink-200 bg-white text-sm text-ink-900
              px-3 py-2.5
              focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
            "
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm sm:col-span-1">
          <span className="text-[11.5px] uppercase tracking-[0.04em] font-medium text-ink-500">Date</span>
          <input
            name="incurred_on"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="
              rounded-xl border border-ink-200 bg-white text-sm text-ink-900
              px-3 py-2.5
              focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
            "
          />
        </label>
      </div>

      {kind === "other" && (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-[11.5px] uppercase tracking-[0.04em] font-medium text-ink-500">Custom label</span>
          <input
            name="custom_label"
            required
            maxLength={120}
            placeholder="e.g. Stall mat repair"
            className="
              rounded-xl border border-ink-200 bg-white text-sm text-ink-900
              placeholder:text-ink-400 px-3 py-2.5
              focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
            "
          />
        </label>
      )}

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-[11.5px] uppercase tracking-[0.04em] font-medium text-ink-500">Notes (optional)</span>
        <input
          name="notes"
          maxLength={500}
          className="
            rounded-xl border border-ink-200 bg-white text-sm text-ink-900
            placeholder:text-ink-400 px-3 py-2.5
            focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
          "
        />
      </label>

      {state.error && (
        <p className="text-[11px] text-rose-700">{state.error}</p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-9 px-3 rounded-lg text-[12.5px] text-ink-700 hover:bg-ink-100/60"
        >
          Cancel
        </button>
        <CreateSubmit />
      </div>
    </form>
  );
}

function CreateSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="
        h-9 px-4 rounded-lg text-[12.5px] font-medium
        bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      "
    >
      {pending ? "Saving…" : "Add charge"}
    </button>
  );
}

// =============================================================
// Row
// =============================================================
function ChargeRow({
  charge,
  clientId,
  isOwner,
}: {
  charge: ClientChargeRow;
  clientId: string;
  isOwner: boolean;
}) {
  const status = charge.payment_status;
  const tone =
    status === "paid"    ? "text-emerald-700" :
    status === "partial" ? "text-amber-700" :
                            "text-ink-700";

  return (
    <li className="rounded-xl border border-ink-100 bg-surface px-3 py-2 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-semibold ${KIND_TONE[charge.kind]}`}>
            {charge.kind === "other"
              ? charge.custom_label || KIND_LABEL.other
              : KIND_LABEL[charge.kind]}
          </span>
          <span className="text-[11px] tabular-nums text-ink-500">
            {new Date(charge.incurred_on).toLocaleDateString()}
          </span>
        </div>
        <p className={`text-[11.5px] mt-0.5 ${tone} tabular-nums`}>
          {status === "paid"
            ? `Paid · ${FMT_EUR.format(Number(charge.amount))}`
            : status === "partial"
            ? `Partial · ${FMT_EUR.format(Number(charge.paid_amount))} of ${FMT_EUR.format(Number(charge.amount))}`
            : `Unpaid · ${FMT_EUR.format(Number(charge.amount))}`}
          {charge.notes ? ` · ${charge.notes}` : ""}
        </p>
      </div>
      {isOwner && (
        <div className="flex items-center gap-1.5 shrink-0">
          {status === "paid" || status === "partial" ? (
            <UnpaidButton chargeId={charge.id} clientId={clientId} horseId={charge.horse_id} />
          ) : (
            <PaidButton chargeId={charge.id} clientId={clientId} horseId={charge.horse_id} />
          )}
          <DeleteButton chargeId={charge.id} clientId={clientId} horseId={charge.horse_id} />
        </div>
      )}
    </li>
  );
}

function PaidButton({
  chargeId, clientId, horseId,
}: { chargeId: string; clientId: string; horseId: string | null }) {
  const [, action] = useFormState<ChargeActionState, FormData>(
    markPaidAction, initialState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="charge_id" value={chargeId} />
      <input type="hidden" name="client_id" value={clientId} />
      {horseId && <input type="hidden" name="horse_id" value={horseId} />}
      <input type="hidden" name="method"   value="cash"     />
      <PaidSubmit />
    </form>
  );
}

function PaidSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="
        h-8 px-2.5 rounded-lg text-[11px] font-semibold whitespace-nowrap
        bg-emerald-600 text-white hover:bg-emerald-700
        disabled:opacity-50 transition-colors
      "
    >
      {pending ? "…" : "Mark paid"}
    </button>
  );
}

function UnpaidButton({
  chargeId, clientId, horseId,
}: { chargeId: string; clientId: string; horseId: string | null }) {
  const [, action] = useFormState<ChargeActionState, FormData>(
    markUnpaidAction, initialState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="charge_id" value={chargeId} />
      <input type="hidden" name="client_id" value={clientId} />
      {horseId && <input type="hidden" name="horse_id" value={horseId} />}
      <UnpaidSubmit />
    </form>
  );
}

function UnpaidSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="
        h-8 px-2.5 rounded-lg text-[11px] font-medium whitespace-nowrap
        border border-ink-200 bg-white text-ink-700 hover:bg-ink-100/60
        disabled:opacity-50 transition-colors
      "
    >
      {pending ? "…" : "Undo"}
    </button>
  );
}

function DeleteButton({
  chargeId, clientId, horseId,
}: { chargeId: string; clientId: string; horseId: string | null }) {
  const [, action] = useFormState<ChargeActionState, FormData>(
    deleteChargeAction, initialState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="charge_id" value={chargeId} />
      <input type="hidden" name="client_id" value={clientId} />
      {horseId && <input type="hidden" name="horse_id" value={horseId} />}
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
      onClick={(e) => {
        if (!confirm("Delete this charge?")) e.preventDefault();
      }}
      aria-label="Delete charge"
      className="text-ink-400 hover:text-rose-700 px-1 text-[14px] leading-none disabled:opacity-50 transition-colors"
    >
      ✕
    </button>
  );
}
