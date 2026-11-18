"use client";

// Gift-voucher register on a client profile. Shows each voucher's code,
// service, value, validity and — when it's a lessons voucher — the live
// "used / remaining" straight off the backing package. The owner adds a
// voucher (optionally creating the N-lesson package that powers redemption),
// edits the register details, or removes a row. Actual redemption ("atsiskaito
// kuponu") happens on the lesson via the existing "Use package" flow, which
// decrements the remaining count shown here automatically.

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  createVoucherAction,
  updateVoucherAction,
  deleteVoucherAction,
  type VoucherActionState,
} from "@/app/dashboard/clients/[id]/voucher-actions";
import type { GiftVoucher } from "@/services/giftVouchers";

const initial: VoucherActionState = { error: null, success: false };
const eur = (n: number) => `€${n.toFixed(2)}`;
const fmt = (ymd: string | null) =>
  ymd ? new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

function status(v: GiftVoucher): { label: string; cls: string } {
  if (v.is_expired) return { label: "Nebegalioja", cls: "bg-ink-100 text-ink-600" };
  if (v.lessons_remaining === 0 || v.redeemed) return { label: "Panaudotas", cls: "bg-ink-100 text-ink-500" };
  return { label: "Galioja", cls: "bg-emerald-50 text-emerald-700" };
}

export function GiftVoucherPanel({ clientId, vouchers }: { clientId: string; vouchers: GiftVoucher[] }) {
  const [addOpen, setAddOpen] = useState(false);
  const [addState, addAction] = useFormState(createVoucherAction, initial);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Vilnius" });

  useEffect(() => { if (addState.success) setAddOpen(false); }, [addState.success]);

  const empty = vouchers.length === 0;

  // No vouchers and not adding → stay out of the way with a single faint line,
  // so only clients who actually have vouchers carry the full card.
  if (empty && !addOpen) {
    return (
      <div className="px-1">
        <button type="button" onClick={() => setAddOpen(true)}
          className="text-[13px] font-medium text-brand-700 hover:text-brand-800">
          + Pridėti dovanų kuponą
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden">
      <div className="px-5 py-4 border-b border-ink-100 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-navy-900">Dovanų kuponai</h3>
          <p className="text-[12.5px] text-ink-500 mt-0.5">
            Kuponai su pamokomis skaičiuoja likutį automatiškai — nuskaitoma pamokoje per „Use package".
          </p>
        </div>
        {!addOpen && (
          <button type="button" onClick={() => setAddOpen(true)}
            className="text-[13px] font-medium text-brand-700 hover:text-brand-800">
            + Pridėti kuponą
          </button>
        )}
      </div>

      {addOpen && (
        <form action={addAction} className="px-5 py-4 border-b border-ink-100 flex flex-col gap-3">
          <input type="hidden" name="client_id" value={clientId} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Field label="Kupono nr."><input name="code" required placeholder="TJK-261006-01" className={inp} /></Field>
            <Field label="Data"><input type="date" name="issued_on" required defaultValue={today} className={inp} /></Field>
            <Field label="Suma · €"><input name="amount" inputMode="decimal" required placeholder="120" className={inp} /></Field>
            <Field label="Paslauga"><input name="service_label" placeholder="Mėnesinis abonementas (4 pamokos)" className={inp} /></Field>
            <Field label="Pamokų (0 = be paketo)"><input name="lessons" inputMode="numeric" defaultValue="4" className={inp} /></Field>
            <Field label="Mokėjimo būdas"><input name="payment_method" placeholder="Bankinis pavedimas" className={inp} /></Field>
            <Field label="Galioja iki"><input type="date" name="valid_until" className={inp} /></Field>
            <Field label="Apmokėta"><input type="date" name="paid_on" className={inp} /></Field>
            <Field label="Užsakymo nr."><input name="order_no" className={inp} /></Field>
          </div>
          {addState.error && <Err>{addState.error}</Err>}
          <div className="flex items-center gap-2">
            <SubmitBtn label="Pridėti kuponą" pendingLabel="Pridedama…" />
            <button type="button" onClick={() => setAddOpen(false)} className={ghost}>Atšaukti</button>
          </div>
        </form>
      )}

      {empty ? (
        <p className="px-5 py-5 text-[13px] text-ink-500">Kuponų dar nėra.</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {vouchers.map((v) => <VoucherRow key={v.id} voucher={v} clientId={clientId} />)}
        </ul>
      )}
    </div>
  );
}

function VoucherRow({ voucher: v, clientId }: { voucher: GiftVoucher; clientId: string }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useFormState(updateVoucherAction, initial);
  useEffect(() => { if (state.success) setEditing(false); }, [state.success]);

  const st = status(v);

  if (!editing) {
    return (
      <li className="px-5 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] text-ink-900 truncate">
            <span className="font-medium">{v.code}</span>
            {v.service_label ? <span className="text-ink-500"> · {v.service_label}</span> : null}
          </p>
          <p className="text-[12px] text-ink-500 mt-0.5">
            {eur(v.amount)} · galioja iki {fmt(v.valid_until)}
            {v.lessons_total != null && (
              <span className="text-ink-600"> · liko {v.lessons_remaining}/{v.lessons_total} pamok.</span>
            )}
          </p>
        </div>
        <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
        <button type="button" onClick={() => setEditing(true)} className="text-ink-400 hover:text-brand-700 text-[12px] px-1.5">Keisti</button>
        <DeleteForm voucherId={v.id} clientId={clientId} />
      </li>
    );
  }

  return (
    <li className="px-5 py-3">
      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="voucher_id" value={v.id} />
        <input type="hidden" name="client_id" value={clientId} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Field label="Kupono nr."><input name="code" required defaultValue={v.code} className={inp} /></Field>
          <Field label="Data"><input type="date" name="issued_on" required defaultValue={v.issued_on} className={inp} /></Field>
          <Field label="Suma · €"><input name="amount" inputMode="decimal" required defaultValue={v.amount.toFixed(2)} className={inp} /></Field>
          <Field label="Paslauga"><input name="service_label" defaultValue={v.service_label ?? ""} className={inp} /></Field>
          <Field label="Mokėjimo būdas"><input name="payment_method" defaultValue={v.payment_method ?? ""} className={inp} /></Field>
          <Field label="Galioja iki"><input type="date" name="valid_until" defaultValue={v.valid_until ?? ""} className={inp} /></Field>
          <Field label="Apmokėta"><input type="date" name="paid_on" defaultValue={v.paid_on ?? ""} className={inp} /></Field>
          <Field label="Užsakymo nr."><input name="order_no" defaultValue={v.order_no ?? ""} className={inp} /></Field>
          <label className="flex items-end gap-2 text-[12px] text-ink-700 pb-2">
            <input type="checkbox" name="redeemed" value="true" defaultChecked={v.redeemed} className="w-4 h-4 rounded border-ink-300 text-brand-600" />
            Pažymėti panaudotą
          </label>
        </div>
        {state.error && <Err>{state.error}</Err>}
        <div className="flex items-center gap-2">
          <SubmitBtn label="Išsaugoti" pendingLabel="Saugoma…" />
          <button type="button" onClick={() => setEditing(false)} className={ghost}>Atšaukti</button>
        </div>
      </form>
    </li>
  );
}

function DeleteForm({ voucherId, clientId }: { voucherId: string; clientId: string }) {
  const [, action] = useFormState(deleteVoucherAction, initial);
  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="voucher_id" value={voucherId} />
      <input type="hidden" name="client_id" value={clientId} />
      <DeleteBtn />
    </form>
  );
}

function DeleteBtn() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} title="Pašalinti" className="text-ink-400 hover:text-rose-600 text-sm px-1.5 disabled:opacity-50">✕</button>;
}

function SubmitBtn({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="h-9 px-4 rounded-xl text-[13px] font-medium bg-brand-600 text-white shadow-sm hover:bg-brand-700 disabled:opacity-50">
      {pending ? pendingLabel : label}
    </button>
  );
}

const inp = "rounded-lg border border-ink-200 bg-white text-sm text-ink-900 placeholder:text-ink-400 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500";
const ghost = "h-9 px-3 rounded-xl text-[13px] font-medium text-ink-600 hover:bg-ink-100";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-[0.04em] text-ink-500">
      {label}
      {children}
    </label>
  );
}
function Err({ children }: { children: React.ReactNode }) {
  return <p role="alert" className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5">{children}</p>;
}
