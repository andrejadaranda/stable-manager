"use client";

// Add a new health record. Opens as a small inline panel from the
// timeline header, matching the AddSessionSheet pattern but lighter
// (no full-screen overlay — health adds are less frequent).

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import {
  createHealthRecordAction,
  type CreateHealthState,
} from "@/app/dashboard/horses/[id]/health-actions";
import { HEALTH_RECORD_KINDS } from "@/services/horseHealth.types";

const initial: CreateHealthState = { error: null, success: false };

const KIND_LABEL = {
  vaccination: "Vaccination",
  farrier:     "Farrier",
  vet:         "Vet visit",
  injury:      "Injury",
};

const todayLocal = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function AddHealthRecordButton({ horseId }: { horseId: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click while open.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[12px] text-brand-700 hover:text-brand-800 font-medium inline-flex items-center gap-1"
      >
        <span aria-hidden>＋</span> Add record
      </button>

      {open && (
        <div className="absolute right-0 top-7 z-30 w-[320px] max-w-[92vw] card-elevated p-4">
          <AddHealthRecordForm horseId={horseId} onDone={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

function AddHealthRecordForm({
  horseId,
  onDone,
}: {
  horseId: string;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(createHealthRecordAction, initial);
  const [kind, setKind] = useState<keyof typeof KIND_LABEL>("vaccination");

  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  const showNextDue = kind !== "injury";
  const showResolved = kind === "injury";

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="horse_id" value={horseId} />

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-[11px] tracking-[0.04em] uppercase text-ink-500">Type</legend>
        <div className="flex flex-wrap gap-1.5">
          {HEALTH_RECORD_KINDS.map((k, i) => (
            <label key={k} className="cursor-pointer">
              <input
                type="radio"
                name="kind"
                value={k}
                defaultChecked={i === 0}
                onChange={() => setKind(k)}
                className="peer sr-only"
              />
              <span className="inline-block px-2.5 py-1 rounded-full text-[12px] bg-ink-100 text-ink-700 peer-checked:bg-brand-600 peer-checked:text-white transition-colors">
                {KIND_LABEL[k]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="block text-[11px] tracking-[0.04em] uppercase text-ink-500 mb-1">Title</span>
        <input
          type="text"
          name="title"
          required
          maxLength={200}
          placeholder={kind === "vaccination" ? "Annual EHV-1 booster" : kind === "farrier" ? "Trim + reset shoes" : kind === "vet" ? "Routine check" : "Soft tissue strain"}
          className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-[13px] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="block text-[11px] tracking-[0.04em] uppercase text-ink-500 mb-1">When</span>
          <input
            type="date"
            name="occurred_on"
            defaultValue={todayLocal()}
            required
            className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-[13px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
          />
        </label>
        {showNextDue && (
          <label className="block">
            <span className="block text-[11px] tracking-[0.04em] uppercase text-ink-500 mb-1">Next due</span>
            <input
              type="date"
              name="next_due_on"
              className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-[13px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
            />
          </label>
        )}
        {showResolved && (
          <label className="block">
            <span className="block text-[11px] tracking-[0.04em] uppercase text-ink-500 mb-1">Resolved on</span>
            <input
              type="date"
              name="resolved_on"
              className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-[13px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
            />
          </label>
        )}
      </div>

      <label className="block">
        <span className="block text-[11px] tracking-[0.04em] uppercase text-ink-500 mb-1">Notes</span>
        <textarea
          name="notes"
          rows={2}
          maxLength={2000}
          placeholder="Optional"
          className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-[13px] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
        />
      </label>

      {state.error && <p className="text-[11px] text-rose-600">{state.error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onDone}
          className="text-[12px] text-ink-500 hover:text-ink-900 px-2 py-1"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="text-[12px] text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-md font-medium"
        >
          Save
        </button>
      </div>
    </form>
  );
}
