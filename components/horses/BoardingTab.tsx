"use client";

// Horse boarding panel — owner-facing.
//
// Two areas:
//   1. Monthly fee — sets horses.monthly_boarding_fee for quick prefill
//      when adding a new charge.
//   2. Charges — list of past + current billing periods with one-click
//      "Mark paid" / "Mark unpaid" actions that translate to payments.
//
// Read-only fallback for non-owners: they see the data but interactive
// buttons are hidden. The page above already routes by role; this is
// defense-in-depth.

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  setMonthlyFeeAction,
  createChargeAction,
  deleteChargeAction,
  markChargePaidAction,
  markChargeUnpaidAction,
  setOwnerAction,
  setLessonsAvailabilityAction,
  type BoardingActionState,
} from "@/app/dashboard/horses/[id]/boarding-actions";
import type { BoardingChargeRow } from "@/services/boarding";
import type { ClientChargeRow } from "@/services/clientCharges";
import { ChargesPanel } from "@/components/clients/charges-panel";

type ClientOpt = { id: string; full_name: string };

const initialState: BoardingActionState = { error: null, success: false };

const FMT_EUR = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "EUR",
});

export function BoardingTab({
  horseId,
  horseName,
  ownerClient,
  monthlyFee,
  availableForLessons,
  charges,
  miscCharges,
  clients,
  isOwner,
}: {
  horseId: string;
  horseName: string;
  ownerClient: { id: string; full_name: string } | null;
  monthlyFee: number | null;
  /** True if this client-owned horse is opted into the lessons dropdown. */
  availableForLessons: boolean;
  charges: BoardingChargeRow[];
  /** Misc charges (farrier, equipment, etc) tagged to this horse. */
  miscCharges: ClientChargeRow[];
  /** Active clients in the stable, used by the owner-picker on this tab. */
  clients: ClientOpt[];
  isOwner: boolean;
}) {
  const totalDue = charges.reduce((acc, c) => {
    const remaining = Math.max(0, Number(c.amount) - Number(c.paid_amount));
    return acc + remaining;
  }, 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Header KPIs ---------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          label="Owner"
          value={ownerClient?.full_name ?? "—"}
          sub={ownerClient ? "Boarding billed to" : "No owner set"}
        />
        <KpiCard
          label="Monthly fee"
          value={monthlyFee == null ? "—" : FMT_EUR.format(Number(monthlyFee))}
          sub="Pre-fills new charges"
        />
        <KpiCard
          label="Outstanding"
          value={FMT_EUR.format(totalDue)}
          sub={totalDue > 0 ? "Across open charges" : "All paid up"}
          tone={totalDue > 0 ? "warn" : "ok"}
        />
      </div>

      {/* Owner picker — owner-only ----------------------------------- */}
      {isOwner && (
        <OwnerPanel
          horseId={horseId}
          currentOwner={ownerClient}
          clients={clients}
        />
      )}

      {/* Lessons-availability toggle — only meaningful when the horse
          is client-owned. Stable horses are always eligible. */}
      {isOwner && ownerClient && (
        <LessonsAvailabilityPanel
          horseId={horseId}
          initialValue={availableForLessons}
        />
      )}

      {/* Monthly fee setter ---------------------------------------- */}
      {isOwner && (
        <MonthlyFeePanel horseId={horseId} initialFee={monthlyFee} />
      )}

      {/* Misc charges (farrier, equipment, etc) — shown only when
          horse has an owner client to bill against. */}
      {ownerClient && (
        <section className="bg-white rounded-2xl shadow-soft p-5 flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold text-navy-900">Other charges</h3>
            <p className="text-[11.5px] text-ink-500 mt-0.5">
              Farrier, equipment, supplements — anything outside the
              monthly boarding fee. Bills to {ownerClient.full_name}.
            </p>
          </div>
          <ChargesPanel
            clientId={ownerClient.id}
            charges={miscCharges}
            horseId={horseId}
            isOwner={isOwner}
            bare
          />
        </section>
      )}

      {/* Charges list ---------------------------------------------- */}
      <section className="bg-white rounded-2xl shadow-soft p-5">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-sm font-semibold text-navy-900">Charges</h3>
          <span className="text-[11px] uppercase tracking-[0.14em] font-medium text-ink-500">
            {charges.length} {charges.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        {isOwner && ownerClient && (
          <NewChargeForm
            horseId={horseId}
            horseName={horseName}
            defaultAmount={monthlyFee}
          />
        )}
        {isOwner && !ownerClient && (
          <p className="text-[12.5px] text-ink-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4">
            Set an owner on the horse first (from the Overview tab) — boarding charges bill against the owner client.
          </p>
        )}

        {charges.length === 0 ? (
          <p className="text-sm text-ink-500 mt-2">No charges yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 mt-3">
            {charges.map((c) => (
              <ChargeRow key={c.id} charge={c} horseId={horseId} isOwner={isOwner} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// =============================================================
// Owner picker
// =============================================================
function OwnerPanel({
  horseId,
  currentOwner,
  clients,
}: {
  horseId: string;
  currentOwner: { id: string; full_name: string } | null;
  clients: ClientOpt[];
}) {
  const [state, action] = useFormState<BoardingActionState, FormData>(
    setOwnerAction, initialState,
  );
  const [ownerId, setOwnerId] = useState<string>(currentOwner?.id ?? "");
  const dirty = ownerId !== (currentOwner?.id ?? "");

  return (
    <form
      action={action}
      className="bg-white rounded-2xl shadow-soft p-4 flex items-end gap-3"
    >
      <input type="hidden" name="horse_id" value={horseId} />
      <label className="flex flex-col gap-1.5 text-sm flex-1 min-w-0">
        <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">
          Owner client
        </span>
        <select
          name="owner_client_id"
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          className="
            rounded-xl border border-ink-200 bg-white text-sm text-ink-900
            px-3 py-2.5
            focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
          "
        >
          <option value="">— No owner —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.full_name}</option>
          ))}
        </select>
        {state.error && (
          <span className="text-[11px] text-rose-700 mt-0.5">{state.error}</span>
        )}
      </label>
      <SaveOwnerButton disabled={!dirty} />
    </form>
  );
}

function SaveOwnerButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="
        h-10 px-4 rounded-xl text-sm font-medium
        bg-navy-900 text-white shadow-sm hover:bg-navy-800 active:bg-navy-700
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      "
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

// =============================================================
// Lessons availability (client-owned horses only)
// =============================================================
function LessonsAvailabilityPanel({
  horseId,
  initialValue,
}: {
  horseId: string;
  initialValue: boolean;
}) {
  const [state, action] = useFormState<BoardingActionState, FormData>(
    setLessonsAvailabilityAction, initialState,
  );
  const [available, setAvailable] = useState(initialValue);

  return (
    <form
      action={action}
      className="bg-white rounded-2xl shadow-soft p-4 flex items-start gap-3"
    >
      <input type="hidden" name="horse_id" value={horseId} />
      <input type="hidden" name="available" value={String(available)} />
      <label className="flex items-start gap-3 cursor-pointer flex-1">
        <input
          type="checkbox"
          checked={available}
          onChange={(e) => setAvailable(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-navy-900">
            Available for stable lessons
          </p>
          <p className="text-[11.5px] text-ink-600 mt-0.5">
            Client-owned horses are hidden from the lessons dropdown by default.
            Toggle on if the owner agrees to lend this horse for trainer-led
            lessons (typically with a discount arrangement).
          </p>
          {state.error && (
            <p className="text-[11px] text-rose-700 mt-1">{state.error}</p>
          )}
        </div>
      </label>
      <SaveAvailabilityButton disabled={available === initialValue} />
    </form>
  );
}

function SaveAvailabilityButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="
        h-10 px-4 rounded-xl text-sm font-medium shrink-0
        bg-navy-900 text-white shadow-sm hover:bg-navy-800 active:bg-navy-700
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      "
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

// =============================================================
// Monthly fee
// =============================================================
function MonthlyFeePanel({
  horseId,
  initialFee,
}: {
  horseId: string;
  initialFee: number | null;
}) {
  const [state, action] = useFormState<BoardingActionState, FormData>(
    setMonthlyFeeAction, initialState,
  );
  const [fee, setFee] = useState(initialFee == null ? "" : String(initialFee));

  return (
    <form
      action={action}
      className="bg-white rounded-2xl shadow-soft p-4 flex items-end gap-3"
    >
      <input type="hidden" name="horse_id" value={horseId} />
      <label className="flex flex-col gap-1.5 text-sm flex-1 min-w-0">
        <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">
          Monthly boarding fee · €
        </span>
        <input
          name="fee"
          type="number"
          min="0"
          step="0.01"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
          placeholder="Leave empty to clear"
          className="
            rounded-xl border border-ink-200 bg-white text-sm text-ink-900
            placeholder:text-ink-400 px-3 py-2.5
            focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
          "
        />
        {state.error && (
          <span className="text-[11px] text-rose-700 mt-0.5">{state.error}</span>
        )}
      </label>
      <SaveFeeButton />
    </form>
  );
}

function SaveFeeButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="
        h-10 px-4 rounded-xl text-sm font-medium
        bg-navy-900 text-white shadow-sm hover:bg-navy-800 active:bg-navy-700
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      "
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

// =============================================================
// New charge inline form
// =============================================================
function NewChargeForm({
  horseId,
  horseName,
  defaultAmount,
}: {
  horseId: string;
  horseName: string;
  defaultAmount: number | null;
}) {
  const [state, action] = useFormState<BoardingActionState, FormData>(
    createChargeAction, initialState,
  );
  const [open, setOpen] = useState(false);

  // Default to the current calendar month's range so the common case
  // is one click → submit.
  const today = new Date();
  const periodStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString().slice(0, 10);
  const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString().slice(0, 10);
  const defaultLabel = today.toLocaleDateString(undefined, {
    month: "long", year: "numeric",
  });

  useEffect(() => { if (state.success) setOpen(false); }, [state.success]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="
          h-10 px-4 rounded-xl text-sm font-medium
          bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800
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
      className="rounded-2xl border border-ink-100 bg-surface p-4 flex flex-col gap-3 mb-3"
    >
      <input type="hidden" name="horse_id" value={horseId} />

      <p className="text-[11px] uppercase tracking-[0.14em] text-ink-500 font-semibold">
        Charge — {horseName}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Period start" name="period_start" type="date" defaultValue={periodStart} required />
        <Field label="Period end"   name="period_end"   type="date" defaultValue={periodEnd}   required />
        <Field label="Amount · €"   name="amount"       type="number" min="0" step="0.01" defaultValue={defaultAmount != null ? String(defaultAmount) : ""} required />
      </div>
      <Field label="Label (optional)" name="period_label" defaultValue={defaultLabel} placeholder="April 2026" />
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">
          Notes (optional)
        </span>
        <textarea
          name="notes"
          rows={2}
          maxLength={500}
          className="
            rounded-xl border border-ink-200 bg-white text-sm text-ink-900
            placeholder:text-ink-400 px-3 py-2.5
            focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
          "
        />
      </label>

      <p
        role="alert"
        aria-live="polite"
        className={
          state.error
            ? "text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2"
            : "sr-only"
        }
      >
        {state.error || ""}
      </p>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-10 px-4 rounded-xl text-sm text-ink-700 hover:bg-ink-100/60"
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
        h-10 px-5 rounded-xl text-sm font-medium
        bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      "
    >
      {pending ? "Creating…" : "Create charge"}
    </button>
  );
}

// =============================================================
// Charge row
// =============================================================
function ChargeRow({
  charge,
  horseId,
  isOwner,
}: {
  charge: BoardingChargeRow;
  horseId: string;
  isOwner: boolean;
}) {
  const label =
    charge.period_label ||
    `${new Date(charge.period_start).toLocaleDateString()} → ${new Date(charge.period_end).toLocaleDateString()}`;

  const status = charge.payment_status;
  const tone =
    status === "paid"    ? "text-emerald-700" :
    status === "partial" ? "text-amber-700"   :
                           "text-ink-700";

  return (
    <li className="rounded-2xl bg-white border border-ink-100 px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-navy-900 truncate">{label}</p>
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
            <UnpaidButton chargeId={charge.id} horseId={horseId} />
          ) : (
            <PaidButton chargeId={charge.id} horseId={horseId} />
          )}
          <DeleteButton chargeId={charge.id} horseId={horseId} />
        </div>
      )}
    </li>
  );
}

function PaidButton({ chargeId, horseId }: { chargeId: string; horseId: string }) {
  const [, action] = useFormState<BoardingActionState, FormData>(
    markChargePaidAction, initialState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="charge_id" value={chargeId} />
      <input type="hidden" name="horse_id"  value={horseId}  />
      <input type="hidden" name="method"    value="cash"     />
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
        h-9 px-3 rounded-xl text-xs font-semibold whitespace-nowrap
        bg-emerald-600 text-white hover:bg-emerald-700
        disabled:opacity-50 transition-colors
      "
    >
      {pending ? "Marking…" : "Mark paid"}
    </button>
  );
}

function UnpaidButton({ chargeId, horseId }: { chargeId: string; horseId: string }) {
  const [, action] = useFormState<BoardingActionState, FormData>(
    markChargeUnpaidAction, initialState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="charge_id" value={chargeId} />
      <input type="hidden" name="horse_id"  value={horseId}  />
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
        h-9 px-3 rounded-xl text-xs font-medium whitespace-nowrap
        border border-ink-200 bg-white text-ink-700 hover:bg-ink-100/60
        disabled:opacity-50 transition-colors
      "
    >
      {pending ? "Reverting…" : "Mark unpaid"}
    </button>
  );
}

function DeleteButton({ chargeId, horseId }: { chargeId: string; horseId: string }) {
  const [, action] = useFormState<BoardingActionState, FormData>(
    deleteChargeAction, initialState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="charge_id" value={chargeId} />
      <input type="hidden" name="horse_id"  value={horseId}  />
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
        if (!confirm("Delete this charge? Linked payments stay but are detached.")) e.preventDefault();
      }}
      className="h-9 px-2 rounded-xl text-[11px] text-ink-500 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-50 transition-colors"
    >
      {pending ? "…" : "Delete"}
    </button>
  );
}

// =============================================================
// Primitives
// =============================================================
function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "ok" | "warn";
}) {
  const valueClass =
    tone === "warn" ? "text-amber-700" :
    tone === "ok"   ? "text-emerald-700" :
                      "text-navy-900";
  return (
    <div className="bg-white rounded-2xl shadow-soft p-4">
      <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-500">
        {label}
      </p>
      <p className={`font-display text-2xl mt-1 tabular-nums ${valueClass}`}>
        {value}
      </p>
      <p className="text-[11.5px] text-ink-500 mt-0.5">{sub}</p>
    </div>
  );
}

function Field(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label: string },
) {
  const { label, ...rest } = props;
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">{label}</span>
      <input
        className="
          rounded-xl border border-ink-200 bg-white text-sm text-ink-900
          placeholder:text-ink-400 px-3 py-2.5
          focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
        "
        {...rest}
      />
    </label>
  );
}
