"use client";

// Client detail packages panel.
//
// Shows the active package up top (used / remaining ring), a list of
// past / inactive packages below, and a "+ New package" CTA that opens
// a small modal mirroring the create-lesson form's aesthetic.
//
// Owner-only by gating the buttons + actions; the page above this
// already routes by role, so we don't re-check here.

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  createPackageAction,
  deletePackageAction,
  recordPackagePaymentAction,
  type PackageActionState,
} from "@/app/dashboard/clients/[id]/package-actions";
import type { PackageSummaryRow } from "@/services/packages";
import { useFocusTrap } from "@/lib/utils/useFocusTrap";

const initialState: PackageActionState = { error: null, success: false };

const FMT_EUR = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function PackagePanel({
  clientId,
  packages,
  isOwner,
}: {
  clientId: string;
  packages: PackageSummaryRow[];
  isOwner: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Active = first non-expired with remaining > 0 (oldest first).
  const active = packages
    .filter((p) => !p.is_expired && p.lessons_remaining > 0)
    .sort((a, b) => +new Date(a.purchased_at) - +new Date(b.purchased_at))[0];
  const others = packages.filter((p) => p !== active);

  return (
    <section className="bg-white rounded-2xl shadow-soft p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-navy-900">Packages</h2>
          <p className="text-[11.5px] text-ink-500 mt-0.5">
            Prepaid lesson bundles. Each scheduled lesson consumes one slot.
          </p>
        </div>
        {isOwner && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="
              h-9 px-3.5 rounded-xl text-xs font-medium
              bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800
              transition-colors
            "
          >
            + New package
          </button>
        )}
      </div>

      {!active && others.length === 0 && (
        <p className="text-sm text-ink-500">No packages yet.</p>
      )}

      {active && (
        <ActivePackageCard pkg={active} isOwner={isOwner} clientId={clientId} />
      )}

      {others.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-500 mb-2">
            Past packages
          </p>
          <ul className="flex flex-col gap-1.5">
            {others.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-ink-100 bg-surface px-3 py-2 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink-900">
                    {p.total_lessons} lessons · {FMT_EUR.format(Number(p.price))}
                  </p>
                  <p className="text-[11px] text-ink-500">
                    {new Date(p.purchased_at).toLocaleDateString()}
                    {" · "}
                    {p.lessons_used} of {p.total_lessons} used
                    {p.is_expired ? " · expired" : ""}
                  </p>
                </div>
                {isOwner && (
                  <DeleteButton packageId={p.id} clientId={clientId} />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && (
        <NewPackageDialog
          clientId={clientId}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}

// ---------- active package card --------------------------------

function ActivePackageCard({
  pkg,
  isOwner,
  clientId,
}: {
  pkg: PackageSummaryRow;
  isOwner: boolean;
  clientId: string;
}) {
  const usedPct = Math.min(100, Math.round((pkg.lessons_used / pkg.total_lessons) * 100));
  const expiresLabel = pkg.expires_at
    ? new Date(pkg.expires_at).toLocaleDateString()
    : null;

  return (
    <div className="rounded-2xl bg-brand-50/60 border border-brand-100 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <UsageRing usedPct={usedPct} remaining={pkg.lessons_remaining} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-brand-700">
            Active package
          </p>
          <p className="font-display text-2xl text-navy-900 mt-0.5 leading-tight">
            {pkg.lessons_remaining} <span className="text-base font-medium text-ink-500">of {pkg.total_lessons} left</span>
          </p>
          <p className="text-[12px] mt-1">
            <PayStatusLabel pkg={pkg} />
            {expiresLabel ? <span className="text-ink-500"> · expires {expiresLabel}</span> : <span className="text-ink-500"> · no expiry</span>}
          </p>
        </div>
        {isOwner && (
          <DeleteButton packageId={pkg.id} clientId={clientId} small />
        )}
      </div>
      {isOwner && <RecordPackagePayment pkg={pkg} clientId={clientId} />}
    </div>
  );
}

// Real payment status from paid_amount vs price (no more "always paid").
function PayStatusLabel({ pkg }: { pkg: PackageSummaryRow }) {
  const paid = Number(pkg.paid_amount ?? 0);
  const price = Number(pkg.price);
  if (paid >= price && price > 0) return <span className="text-emerald-700 font-medium">Paid · {FMT_EUR.format(price)}</span>;
  if (paid > 0) return <span className="text-amber-700 font-medium">Partial · {FMT_EUR.format(paid)} of {FMT_EUR.format(price)}</span>;
  return <span className="text-ink-700 font-medium">Unpaid · {FMT_EUR.format(price)}</span>;
}

// Inline "Record payment" — how much, how, and when. Shown when there's
// still a balance owed on the package. Its own <form> (sibling of the
// delete form, not nested).
function RecordPackagePayment({ pkg, clientId }: { pkg: PackageSummaryRow; clientId: string }) {
  const paid = Number(pkg.paid_amount ?? 0);
  const price = Number(pkg.price);
  const due = Math.max(0, Number((price - paid).toFixed(2)));
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState<PackageActionState, FormData>(recordPackagePaymentAction, initialState);
  useEffect(() => { if (state.success) setOpen(false); }, [state.success]);

  if (due <= 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-[12px] font-medium text-brand-700 hover:text-brand-800"
      >
        + Record payment
      </button>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const inputCls = "rounded-lg border border-ink-200 bg-white text-sm text-ink-900 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500";

  return (
    <form action={action} className="rounded-xl border border-brand-200 bg-white px-3 py-3 flex flex-col gap-2.5">
      <input type="hidden" name="package_id" value={pkg.id} />
      <input type="hidden" name="client_id" value={clientId} />
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] font-medium text-navy-900">Record payment</p>
        <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-ink-500 hover:text-navy-900">Cancel</button>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex flex-col gap-1 text-[12px] text-ink-600">
          Amount · €
          <input type="number" name="amount" min={0} step="0.01" defaultValue={String(due)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-ink-600">
          Method
          <select name="method" defaultValue="cash" className={inputCls}>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="transfer">Transfer</option>
            <option value="other">Other</option>
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-[12px] text-ink-600">
        When
        <input type="date" name="paid_at" defaultValue={today} className={inputCls} />
      </label>
      {state.error && <p className="text-[11.5px] text-rose-700">{state.error}</p>}
      <RecordSubmit />
    </form>
  );
}

function RecordSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-9 px-3.5 rounded-lg text-[13px] font-medium bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed self-start transition-colors"
    >
      {pending ? "Saving…" : "Save payment"}
    </button>
  );
}

function UsageRing({ usedPct, remaining }: { usedPct: number; remaining: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - usedPct / 100);
  return (
    <div className="relative w-16 h-16 shrink-0" aria-hidden>
      <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
        <circle
          cx="32" cy="32" r={radius}
          stroke="#FED7C3" strokeWidth="6" fill="none"
        />
        <circle
          cx="32" cy="32" r={radius}
          stroke="#E04E25" strokeWidth="6" fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-semibold tabular-nums text-navy-900">
          {remaining}
        </span>
      </div>
    </div>
  );
}

// ---------- delete button --------------------------------------

function DeleteButton({
  packageId,
  clientId,
  small,
}: {
  packageId: string;
  clientId: string;
  small?: boolean;
}) {
  const [state, action] = useFormState<PackageActionState, FormData>(
    deletePackageAction, initialState,
  );
  return (
    <form action={action} title={state.error ?? undefined}>
      <input type="hidden" name="package_id" value={packageId} />
      <input type="hidden" name="client_id"  value={clientId}  />
      <DeleteSubmit small={small} />
    </form>
  );
}

function DeleteSubmit({ small }: { small?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!confirm("Delete this package? Lessons stay but are detached.")) e.preventDefault();
      }}
      className={
        small
          ? "text-[11px] text-ink-500 hover:text-rose-700 disabled:opacity-50"
          : "text-[11px] text-ink-500 hover:text-rose-700 disabled:opacity-50"
      }
    >
      {pending ? "…" : "Delete"}
    </button>
  );
}

// ---------- new package dialog ---------------------------------

function NewPackageDialog({
  clientId,
  onClose,
}: {
  clientId: string;
  onClose: () => void;
}) {
  const [state, action] = useFormState<PackageActionState, FormData>(
    createPackageAction, initialState,
  );
  const [recordPayment, setRecordPayment] = useState(true);
  const [method, setMethod] = useState<"cash" | "card" | "transfer" | "other">("cash");

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { closeBtnRef.current?.focus(); }, []);
  useFocusTrap(formRef);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-navy-900/40 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="New package"
    >
      <form
        ref={formRef}
        action={action}
        onClick={(e) => e.stopPropagation()}
        className="
          w-full max-w-md
          bg-surface rounded-2xl shadow-lift
          flex flex-col
          max-h-[calc(100vh-2rem)]
          overflow-hidden
          my-auto
        "
      >
        <input type="hidden" name="client_id" value={clientId} />

        <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between shrink-0">
          <h2 className="text-base font-semibold text-navy-900">New package</h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="text-ink-400 hover:text-navy-900 p-1 -mr-1 rounded-lg"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3.5 min-h-0">
          <FormField label="Total lessons" name="total_lessons" type="number" min="1" step="1" defaultValue="8" required />
          <FormField label="Price · €"     name="price"         type="number" min="0" step="0.01" required />

          <FormField
            label="Expires (optional)"
            name="expires_at"
            type="date"
            hint="Leave empty for no expiry."
          />

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">Notes (optional)</span>
            <textarea
              name="notes"
              rows={2}
              maxLength={2000}
              className="
                rounded-xl border border-ink-200 bg-white text-sm text-ink-900
                placeholder:text-ink-400 px-3 py-2.5 leading-relaxed
                focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
              "
            />
          </label>

          <div className="rounded-xl border border-ink-100 bg-white px-3 py-2.5">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                name="record_payment"
                value="true"
                checked={recordPayment}
                onChange={(e) => setRecordPayment(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-navy-900">Log the upfront payment</p>
                <p className="text-[11.5px] text-ink-600 mt-0.5">
                  Adds a payment record at the package price so revenue and balance stay in sync.
                </p>
              </div>
            </label>
            {!recordPayment && (
              <input type="hidden" name="record_payment" value="false" />
            )}
            {recordPayment && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[11.5px] text-ink-500">Method:</span>
                <select
                  name="payment_method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value as typeof method)}
                  className="
                    h-8 rounded-lg border border-ink-200 bg-white text-xs text-ink-900
                    px-2
                    focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
                  "
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="transfer">Transfer</option>
                  <option value="other">Other</option>
                </select>
              </div>
            )}
          </div>

          <p
            id="new-package-error"
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
        </div>

        <div className="px-5 py-3.5 border-t border-ink-100 bg-surface/95 backdrop-blur-sm flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-xl text-sm text-ink-700 hover:bg-ink-100/60"
          >
            Cancel
          </button>
          <Submit />
        </div>
      </form>
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-describedby="new-package-error"
      disabled={pending}
      className="
        h-10 px-5 rounded-xl text-sm font-medium
        bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      "
    >
      {pending ? "Creating…" : "Create package"}
    </button>
  );
}

function FormField(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string },
) {
  const { label, hint, ...rest } = props;
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
      {hint && <span className="text-[11px] text-ink-500 mt-0.5">{hint}</span>}
    </label>
  );
}
