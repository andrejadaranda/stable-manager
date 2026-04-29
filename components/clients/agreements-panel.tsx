"use client";

// Agreements panel on the client detail page.
//
// Shows a checklist of signed documents (waiver, GDPR, stable rules,
// boarding contract, other), the date each was signed, and any notes.
// Owner records new entries; tracking is enough for v1 — uploads /
// e-signature come later.
//
// Boarder readiness banner: if this client owns horses (i.e. is a
// boarder) and one of the boarder-required documents isn't on file,
// we surface it as an amber warning at the top.

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  createAgreementAction,
  deleteAgreementAction,
  type AgreementActionState,
} from "@/app/dashboard/clients/[id]/agreement-actions";
import type { AgreementRow, AgreementKind } from "@/services/agreements";

const initialState: AgreementActionState = { error: null, success: false };

const KIND_LABEL: Record<AgreementKind, string> = {
  waiver:            "Liability waiver",
  gdpr_consent:      "GDPR / data consent",
  stable_rules:      "Stable rules acknowledgement",
  boarding_contract: "Boarding contract",
  other:             "Other",
};

const KIND_TONE: Record<AgreementKind, string> = {
  waiver:            "bg-rose-50 text-rose-700",
  gdpr_consent:      "bg-violet-50 text-violet-700",
  stable_rules:      "bg-sky-50 text-sky-700",
  boarding_contract: "bg-emerald-50 text-emerald-700",
  other:             "bg-ink-100 text-ink-700",
};

export function AgreementsPanel({
  clientId,
  agreements,
  hasBoardedHorses,
  isOwner,
}: {
  clientId: string;
  agreements: AgreementRow[];
  /** True when this client owns at least one horse — surfaces the
   *  boarder-readiness warning when boarder docs are missing. */
  hasBoardedHorses: boolean;
  isOwner: boolean;
}) {
  // Boarder-required docs missing.
  const requiredMissing = hasBoardedHorses
    ? (["boarding_contract", "gdpr_consent", "stable_rules"] as AgreementKind[]).filter(
        (k) => !agreements.some((a) => a.kind === k),
      )
    : [];

  return (
    <section className="bg-white rounded-2xl shadow-soft p-5 flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-sm font-semibold text-navy-900">Signed documents</h2>
          <p className="text-[11.5px] text-ink-500 mt-0.5">
            Track waivers, consent forms, and contracts.
          </p>
        </div>
        <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-500">
          {agreements.length} on file
        </span>
      </div>

      {hasBoardedHorses && requiredMissing.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="text-[12px] font-semibold text-amber-900">
            Boarder readiness — missing
          </p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {requiredMissing.map((k) => (
              <li
                key={k}
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-white text-amber-800 border border-amber-200"
              >
                {KIND_LABEL[k]}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isOwner && <CreateForm clientId={clientId} />}

      {agreements.length === 0 ? (
        <p className="text-sm text-ink-500">Nothing recorded yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {agreements.map((a) => (
            <li
              key={a.id}
              className="rounded-xl border border-ink-100 bg-surface px-3 py-2 flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-semibold ${KIND_TONE[a.kind]}`}
                  >
                    {a.kind === "other"
                      ? a.custom_label || KIND_LABEL.other
                      : KIND_LABEL[a.kind]}
                  </span>
                  {a.required_for_boarders && (
                    <span className="text-[10px] uppercase tracking-[0.14em] font-medium text-ink-500">
                      required
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-ink-500 mt-1 tabular-nums">
                  Signed {new Date(a.signed_at).toLocaleDateString()}
                  {a.notes ? ` · ${a.notes}` : ""}
                </p>
              </div>
              {isOwner && (
                <DeleteButton agreementId={a.id} clientId={clientId} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// =============================================================
// Create
// =============================================================
function CreateForm({ clientId }: { clientId: string }) {
  const [state, action] = useFormState<AgreementActionState, FormData>(
    createAgreementAction,
    initialState,
  );
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<AgreementKind>("waiver");
  const [requiredForBoarders, setRequiredForBoarders] = useState(false);

  // When the user picks boarding_contract, default the required flag on.
  function onKindChange(k: AgreementKind) {
    setKind(k);
    if (k === "boarding_contract" || k === "gdpr_consent" || k === "stable_rules") {
      setRequiredForBoarders(true);
    } else if (k === "waiver" || k === "other") {
      setRequiredForBoarders(false);
    }
  }

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
        + Record signed document
      </button>
    );
  }

  return (
    <form
      action={action}
      className="rounded-xl border border-ink-100 bg-surface p-3 flex flex-col gap-3"
    >
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="required_for_boarders" value={String(requiredForBoarders)} />

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">
          Document
        </span>
        <select
          name="kind"
          value={kind}
          onChange={(e) => onKindChange(e.target.value as AgreementKind)}
          className="
            rounded-xl border border-ink-200 bg-white text-sm text-ink-900
            px-3 py-2.5
            focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
          "
        >
          {(Object.keys(KIND_LABEL) as AgreementKind[]).map((k) => (
            <option key={k} value={k}>{KIND_LABEL[k]}</option>
          ))}
        </select>
      </label>

      {kind === "other" && (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">
            Document name
          </span>
          <input
            name="custom_label"
            required
            maxLength={120}
            placeholder="e.g. Vaccine handling consent"
            className="
              rounded-xl border border-ink-200 bg-white text-sm text-ink-900
              placeholder:text-ink-400 px-3 py-2.5
              focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
            "
          />
        </label>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">
            Signed on
          </span>
          <input
            name="signed_at"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="
              rounded-xl border border-ink-200 bg-white text-sm text-ink-900
              px-3 py-2.5
              focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
            "
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">
            Notes (optional)
          </span>
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
      </div>

      <label className="flex items-center gap-2 text-[12.5px] text-ink-700 cursor-pointer">
        <input
          type="checkbox"
          checked={requiredForBoarders}
          onChange={(e) => setRequiredForBoarders(e.target.checked)}
          className="w-4 h-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
        />
        <span>Required for boarders (counts toward boarder readiness)</span>
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
      {pending ? "Saving…" : "Record"}
    </button>
  );
}

// =============================================================
// Delete
// =============================================================
function DeleteButton({
  agreementId,
  clientId,
}: {
  agreementId: string;
  clientId: string;
}) {
  const [, action] = useFormState<AgreementActionState, FormData>(
    deleteAgreementAction,
    initialState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="agreement_id" value={agreementId} />
      <input type="hidden" name="client_id" value={clientId} />
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
        if (!confirm("Remove this document record?")) e.preventDefault();
      }}
      aria-label="Remove document"
      className="text-ink-400 hover:text-rose-700 px-1 text-[14px] leading-none disabled:opacity-50 transition-colors"
    >
      ✕
    </button>
  );
}
