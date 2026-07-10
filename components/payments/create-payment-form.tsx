"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import {
  addPaymentAction,
  type AddPaymentState,
} from "@/app/dashboard/payments/actions";

const addPaymentInitialState: AddPaymentState = { error: null, success: false };

type ClientOpt = { id: string; full_name: string };
type HorseOpt = { id: string; name: string };
type LessonOpt = {
  id: string;
  starts_at: string;
  client: { id: string } | null;
  horse:  { id: string; name: string } | null;
};
type OutstandingCharge = {
  id: string;
  horse_id: string;
  owner_client_id: string;
  period_label: string | null;
  period_start: string;
  amount: number;
  paid_amount: number;
};

export function CreatePaymentPanel({
  clients,
  lessons,
  horses = [],
  outstanding = [],
}: {
  clients: ClientOpt[];
  lessons: LessonOpt[];
  horses?: HorseOpt[];
  outstanding?: OutstandingCharge[];
}) {
  const [open, setOpen] = useState(false);
  // Empty-state "Record a payment" CTA links to ?new=1 — auto-open.
  const sp = useSearchParams();
  useEffect(() => {
    if (sp.get("new") === "1") setOpen(true);
  }, [sp]);
  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-xl bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700"
      >
        {open ? "Close" : "+ Record payment"}
      </button>
      {open && (
        <CreatePaymentForm
          clients={clients}
          lessons={lessons}
          horses={horses}
          outstanding={outstanding}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function CreatePaymentForm({
  clients,
  lessons,
  horses,
  outstanding,
  onClose,
}: {
  clients: ClientOpt[];
  lessons: LessonOpt[];
  horses: HorseOpt[];
  outstanding: OutstandingCharge[];
  onClose: () => void;
}) {
  const [state, formAction] = useFormState<AddPaymentState, FormData>(
    addPaymentAction, addPaymentInitialState,
  );

  const [clientId, setClientId] = useState<string>("");
  const [newClient, setNewClient] = useState(false);
  const [purpose, setPurpose] = useState<"general" | "boarding">("general");
  const [horseId, setHorseId] = useState<string>("");
  const [chargeId, setChargeId] = useState<string>("");
  const [amountStr, setAmountStr] = useState<string>("");
  const [dateLocal, setDateLocal] = useState<string>(toDateInputValue(new Date()));
  const dateISO = useMemo(() => dateLocalToISO(dateLocal), [dateLocal]);

  const eligibleLessons = useMemo(
    () => (clientId ? lessons.filter((l) => l.client?.id === clientId) : []),
    [clientId, lessons],
  );

  // Unpaid months for the chosen horse, newest first.
  const horseCharges = useMemo(
    () => outstanding
      .filter((c) => c.horse_id === horseId)
      .sort((a, b) => b.period_start.localeCompare(a.period_start)),
    [horseId, outstanding],
  );

  // Picking a month auto-fills the remaining amount and selects the owner
  // as the paying client — closes the double-entry gap.
  function pickCharge(id: string) {
    setChargeId(id);
    const c = outstanding.find((x) => x.id === id);
    if (c) {
      const remaining = Math.max(0, Number(c.amount) - Number(c.paid_amount));
      setAmountStr(remaining ? remaining.toFixed(2) : "");
      setNewClient(false);
      setClientId(c.owner_client_id);
    }
  }

  const selectedHorseName = horses.find((h) => h.id === horseId)?.name ?? "";

  // When a boarding month is linked, cap the amount at its remaining
  // balance (server re-validates — this is just a UX guard).
  const selectedRemaining = (() => {
    if (purpose !== "boarding" || !chargeId) return undefined;
    const c = outstanding.find((x) => x.id === chargeId);
    if (!c) return undefined;
    return Math.max(0, Number(c.amount) - Number(c.paid_amount));
  })();

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  return (
    <form
      action={formAction}
      className="fixed inset-0 z-30 flex items-start justify-center pt-8 md:pt-16 bg-navy-900/40 backdrop-blur-sm overflow-y-auto px-4"
    >
      <div className="bg-white rounded-2xl shadow-lift border border-ink-100 p-5 w-full max-w-md flex flex-col gap-3.5 max-h-[calc(100vh-4rem)] overflow-y-auto my-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-navy-900">Record payment</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-400 hover:text-navy-900 p-1 -mr-1 rounded-lg"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Purpose */}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-700">What for</span>
          <select
            name="purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value as "general" | "boarding")}
            className="rounded-xl border border-ink-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white"
          >
            <option value="general">General payment</option>
            <option value="boarding">Boarding</option>
          </select>
        </label>

        {/* Boarding → which horse */}
        {purpose === "boarding" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-700">For which horse</span>
            <select
              value={horseId}
              onChange={(e) => { setHorseId(e.target.value); setChargeId(""); }}
              className="rounded-xl border border-ink-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white"
            >
              <option value="">Select horse…</option>
              {horses.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
            {/* Horse name folded into the note server-side. */}
            <input type="hidden" name="boarding_horse_name" value={selectedHorseName} />
          </label>
        )}

        {/* Boarding → which unpaid month. Picking one auto-fills the
            remaining amount, selects the owner, and links the payment so
            the month flips to Paid automatically. */}
        {purpose === "boarding" && horseId && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-700">Which month</span>
            {horseCharges.length === 0 ? (
              <span className="text-[12px] text-ink-500 rounded-xl bg-ink-50/60 border border-ink-100 px-3 py-2">
                No unpaid months for this horse. Record it as a general
                boarding payment, or generate the months in the horse&apos;s
                Boarding tab first.
              </span>
            ) : (
              <select
                value={chargeId}
                onChange={(e) => pickCharge(e.target.value)}
                className="rounded-xl border border-ink-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white"
              >
                <option value="">Don&apos;t link to a month</option>
                {horseCharges.map((c) => {
                  const remaining = Math.max(0, Number(c.amount) - Number(c.paid_amount));
                  const label = c.period_label ||
                    new Date(c.period_start).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
                  return (
                    <option key={c.id} value={c.id}>
                      {label} · €{remaining.toFixed(2)} left
                    </option>
                  );
                })}
              </select>
            )}
            <input type="hidden" name="boarding_charge_id" value={chargeId} />
          </label>
        )}

        {/* Client — existing or brand-new */}
        <div className="flex flex-col gap-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-ink-700">Client</span>
            <button
              type="button"
              onClick={() => { setNewClient((v) => !v); setClientId(""); }}
              className="text-[12px] text-brand-700 hover:text-brand-800 font-medium"
            >
              {newClient ? "Pick existing" : "+ New client"}
            </button>
          </div>

          {newClient ? (
            <div className="flex flex-col gap-2">
              <input
                name="new_client_name"
                required
                placeholder="Full name"
                className="rounded-xl border border-ink-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
              <input
                name="new_client_email"
                type="email"
                placeholder="Email (optional)"
                className="rounded-xl border border-ink-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
            </div>
          ) : (
            <select
              name="client_id"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="rounded-xl border border-ink-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white"
            >
              <option value="">Select…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
          )}
        </div>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-ink-700 font-medium">Amount</span>
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            max={selectedRemaining}
            required
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            className="rounded-xl border border-ink-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-ink-400"
          />
          {selectedRemaining != null && (
            <span className="text-[11.5px] text-ink-500">
              €{selectedRemaining.toFixed(2)} left on this month — pay up to this to mark it paid.
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-700">Payment date</span>
          <input
            type="date"
            value={dateLocal}
            onChange={(e) => setDateLocal(e.target.value)}
            required
            className="rounded-xl border border-ink-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
        </label>
        <input type="hidden" name="paid_at" value={dateISO} />

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-700">Method</span>
          <select
            name="method"
            defaultValue="cash"
            className="rounded-xl border border-ink-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white"
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="transfer">Transfer</option>
            <option value="other">Other</option>
          </select>
        </label>

        {/* Optional link to a specific lesson — only for general payments
            of an existing client. */}
        {purpose === "general" && !newClient && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-700 font-medium">Link to a lesson (optional)</span>
            <select
              name="lesson_id"
              defaultValue=""
              disabled={!clientId}
              className="rounded-xl border border-ink-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white disabled:bg-ink-50"
            >
              <option value="">— Not linked —</option>
              {eligibleLessons.map((l) => (
                <option key={l.id} value={l.id}>{fmtLessonOption(l)}</option>
              ))}
            </select>
            {!clientId && (
              <span className="text-[11.5px] text-ink-500 mt-1">Pick a client to see their lessons.</span>
            )}
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-700">Notes (optional)</span>
          <textarea
            name="notes"
            rows={2}
            className="rounded-xl border border-ink-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
        </label>

        <Submit label="Record payment" />
        {state.error && (
          <p className="text-[13px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}

// ---------- primitives ----------
function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded-xl bg-brand-600 text-white py-2.5 text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

// ---------- date helpers ----------
function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateLocalToISO(local: string): string {
  if (!local) return "";
  const d = new Date(local + "T00:00:00");
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function fmtLessonOption(l: LessonOpt): string {
  const d = new Date(l.starts_at);
  const day = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const horse = l.horse?.name ?? "—";
  return `${day} ${time} · ${horse}`;
}
