"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
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

export function CreatePaymentPanel({
  clients,
  lessons,
  horses = [],
}: {
  clients: ClientOpt[];
  lessons: LessonOpt[];
  horses?: HorseOpt[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700"
      >
        {open ? "Close" : "+ New payment"}
      </button>
      {open && (
        <CreatePaymentForm
          clients={clients}
          lessons={lessons}
          horses={horses}
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
  onClose,
}: {
  clients: ClientOpt[];
  lessons: LessonOpt[];
  horses: HorseOpt[];
  onClose: () => void;
}) {
  const [state, formAction] = useFormState<AddPaymentState, FormData>(
    addPaymentAction, addPaymentInitialState,
  );

  const [clientId, setClientId] = useState<string>("");
  const [newClient, setNewClient] = useState(false);
  const [purpose, setPurpose] = useState<"general" | "boarding">("general");
  const [horseId, setHorseId] = useState<string>("");
  const [dateLocal, setDateLocal] = useState<string>(toDateInputValue(new Date()));
  const dateISO = useMemo(() => dateLocalToISO(dateLocal), [dateLocal]);

  const eligibleLessons = useMemo(
    () => (clientId ? lessons.filter((l) => l.client?.id === clientId) : []),
    [clientId, lessons],
  );

  const selectedHorseName = horses.find((h) => h.id === horseId)?.name ?? "";

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  return (
    <form
      action={formAction}
      className="fixed inset-0 z-30 flex items-start justify-center pt-8 md:pt-16 bg-black/40 backdrop-blur-sm overflow-y-auto"
    >
      <div className="bg-white rounded-xl shadow-xl border border-neutral-200 p-6 w-full max-w-md flex flex-col gap-3.5 max-h-[calc(100vh-4rem)] overflow-y-auto my-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Record payment</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-neutral-500 hover:text-neutral-900"
          >
            ✕
          </button>
        </div>

        {/* Purpose */}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-700">What for</span>
          <select
            name="purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value as "general" | "boarding")}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="general">General payment</option>
            <option value="boarding">Boarding</option>
          </select>
        </label>

        {/* Boarding → which horse */}
        {purpose === "boarding" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-700">For which horse</span>
            <select
              value={horseId}
              onChange={(e) => setHorseId(e.target.value)}
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
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

        {/* Client — existing or brand-new */}
        <div className="flex flex-col gap-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-neutral-700">Client</span>
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
                className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
              />
              <input
                name="new_client_email"
                type="email"
                placeholder="Email (optional)"
                className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          ) : (
            <select
              name="client_id"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="">Select…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
          )}
        </div>

        <Field
          label="Amount"
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          required
        />

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-700">Payment date</span>
          <input
            type="date"
            value={dateLocal}
            onChange={(e) => setDateLocal(e.target.value)}
            required
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
          />
        </label>
        <input type="hidden" name="paid_at" value={dateISO} />

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-700">Method</span>
          <select
            name="method"
            defaultValue="cash"
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
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
            <span className="text-neutral-700 font-medium">Link to a lesson (optional)</span>
            <select
              name="lesson_id"
              defaultValue=""
              disabled={!clientId}
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white disabled:bg-neutral-100"
            >
              <option value="">— Not linked —</option>
              {eligibleLessons.map((l) => (
                <option key={l.id} value={l.id}>{fmtLessonOption(l)}</option>
              ))}
            </select>
            {!clientId && (
              <span className="text-[11.5px] text-neutral-500 mt-1">Pick a client to see their lessons.</span>
            )}
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-700">Notes (optional)</span>
          <textarea
            name="notes"
            rows={2}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
          />
        </label>

        <Submit label="Record payment" />
        {state.error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}

// ---------- primitives ----------
function Field(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label: string },
) {
  const { label, ...rest } = props;
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-neutral-700 font-medium">{label}</span>
      <input
        className="border border-neutral-300 rounded-md px-3 py-2 text-sm placeholder:text-neutral-400"
        {...rest}
      />
    </label>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded-md bg-brand-600 text-white py-2.5 text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
