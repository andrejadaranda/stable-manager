"use client";

// Work-for-credit (barter) log on a client profile. The owner records each
// bit of work the client's person did for the stable — date, what they did,
// and the EUR amount earned as stable credit. Those top-ups feed the client's
// credit balance; the account statement below shows every top-up and every
// time credit is spent, with a running balance. A one-tap link opens the
// printable statement (screenshot or Save-as-PDF).

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createBarterAction, deleteBarterAction, updateBarterAction, type BarterActionState } from "@/app/dashboard/clients/[id]/barter-actions";
import type { BarterCreditEntry } from "@/services/barterCredits";

const initial: BarterActionState = { error: null, success: false };

const eur = (n: number) => `€${n.toFixed(2)}`;
const fmtDate = (ymd: string) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function BarterCreditPanel({
  clientId,
  entries,
  barterTotal,
  availableCredit,
  statementHref,
}: {
  clientId: string;
  entries: BarterCreditEntry[];
  barterTotal: number;
  availableCredit: number;
  statementHref: string;
}) {
  const [addState, addAction] = useFormState(createBarterAction, initial);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Vilnius" });

  return (
    <div className="bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden">
      <div className="px-5 py-4 border-b border-ink-100 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-navy-900">Work-for-credit log</h3>
          <p className="text-[12.5px] text-ink-500 mt-0.5">
            Log work done for the stable → it becomes credit, spent on services.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold bg-emerald-50 text-emerald-700" title="Total credit earned from work">
            Earned {eur(barterTotal)}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold bg-brand-50 text-brand-700" title="Credit still available to spend">
            {eur(availableCredit)} available
          </span>
        </div>
      </div>

      {/* Add entry */}
      <form action={addAction} className="px-5 py-4 border-b border-ink-100 flex flex-col gap-3">
        <input type="hidden" name="client_id" value={clientId} />
        <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr_120px] gap-2">
          <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-[0.04em] text-ink-500">
            Date
            <input type="date" name="entry_date" defaultValue={today} required
              className="rounded-lg border border-ink-200 bg-white text-sm text-ink-900 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-[0.04em] text-ink-500">
            Work done
            <input name="description" required maxLength={300} placeholder="e.g. Mucked out 6 stalls, 3h"
              className="rounded-lg border border-ink-200 bg-white text-sm text-ink-900 placeholder:text-ink-400 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-[0.04em] text-ink-500">
            Credit · €
            <input name="amount" inputMode="decimal" required placeholder="30"
              className="rounded-lg border border-ink-200 bg-white text-sm text-ink-900 placeholder:text-ink-400 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
          </label>
        </div>
        {addState.error && (
          <p role="alert" className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5">{addState.error}</p>
        )}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <AddButton />
          <Link href={statementHref} target="_blank"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-700 hover:text-brand-800">
            Download statement (PDF) ↗
          </Link>
        </div>
      </form>

      {/* Entries */}
      {entries.length === 0 ? (
        <p className="px-5 py-5 text-[13px] text-ink-500">No work logged yet. Add the first entry above.</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {entries.map((e) => (
            <EntryRow key={e.id} entry={e} clientId={clientId} />
          ))}
        </ul>
      )}
    </div>
  );
}

// One log line. Reads as a plain row; "Edit" swaps in inline inputs so the
// owner can fix a date / description / amount in place, then Save or Cancel.
function EntryRow({ entry, clientId }: { entry: BarterCreditEntry; clientId: string }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useFormState(updateBarterAction, initial);

  // Collapse back to the read row once a save lands.
  useEffect(() => {
    if (state.success) setEditing(false);
  }, [state.success]);

  if (!editing) {
    return (
      <li className="px-5 py-3 flex items-center gap-3">
        <div className="w-20 shrink-0 text-[12px] text-ink-500 tabular-nums">{fmtDate(entry.entry_date)}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] text-ink-900 truncate">{entry.description}</p>
        </div>
        <div className="shrink-0 text-[14px] font-semibold text-emerald-700 tabular-nums">+{eur(entry.amount)}</div>
        <button type="button" onClick={() => setEditing(true)} title="Edit entry"
          className="text-ink-400 hover:text-brand-700 text-[12px] px-1.5">Edit</button>
        <DeleteForm entryId={entry.id} clientId={clientId} />
      </li>
    );
  }

  return (
    <li className="px-5 py-3">
      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="entry_id" value={entry.id} />
        <input type="hidden" name="client_id" value={clientId} />
        <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr_120px] gap-2">
          <input type="date" name="entry_date" defaultValue={entry.entry_date} required
            className="rounded-lg border border-ink-200 bg-white text-sm text-ink-900 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
          <input name="description" required maxLength={300} defaultValue={entry.description}
            className="rounded-lg border border-ink-200 bg-white text-sm text-ink-900 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
          <input name="amount" inputMode="decimal" required defaultValue={entry.amount.toFixed(2)}
            className="rounded-lg border border-ink-200 bg-white text-sm text-ink-900 px-2.5 py-2 tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
        </div>
        {state.error && (
          <p role="alert" className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5">{state.error}</p>
        )}
        <div className="flex items-center gap-2">
          <SaveButton />
          <button type="button" onClick={() => setEditing(false)}
            className="h-9 px-3 rounded-xl text-[13px] font-medium text-ink-600 hover:bg-ink-100">Cancel</button>
        </div>
      </form>
    </li>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="h-9 px-4 rounded-xl text-[13px] font-medium bg-brand-600 text-white shadow-sm hover:bg-brand-700 disabled:opacity-50">
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="h-10 px-4 rounded-xl text-sm font-medium bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50">
      {pending ? "Adding…" : "+ Add credit entry"}
    </button>
  );
}

function DeleteForm({ entryId, clientId }: { entryId: string; clientId: string }) {
  const [, action] = useFormState(deleteBarterAction, initial);
  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="entry_id" value={entryId} />
      <input type="hidden" name="client_id" value={clientId} />
      <DeleteButton />
    </form>
  );
}

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} title="Remove entry"
      className="text-ink-400 hover:text-rose-600 text-sm px-1.5 disabled:opacity-50">✕</button>
  );
}
