"use client";

// Settings → Import. Paste CSV, hit Import. Server runs each row
// through the same service-layer create as in-form, so RLS +
// validation + same-stable triggers all fire.

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  importClientsAction,
  importHorsesAction,
  type ImportState,
} from "@/app/dashboard/settings/import/actions";

const initial: ImportState = {
  error: null, inserted: null, skipped: null, errors: null,
};

const CLIENT_TEMPLATE = `full_name,email,phone,skill_level,default_lesson_price,notes
Anna Mueller,anna@example.com,+491701111111,intermediate,30,Loves Bella
Tom Becker,tom@example.com,,beginner,25,
Sophie Lambert,,+491702222222,advanced,35,Show prep`;

const HORSE_TEMPLATE = `name,breed,date_of_birth,daily_lesson_limit,weekly_lesson_limit,notes
Bella,Trakehner,2015-03-12,4,18,Calm with kids
Apollo,Hanoverian,2012-07-04,3,15,Strong jumper
Atlas,Heavy draft,2017-09-01,5,20,`;

export function ImportPanel() {
  return (
    <div className="flex flex-col gap-5">
      <ImportSection
        title="Clients"
        subtitle="Required: full_name. Optional: email, phone, skill_level (beginner/intermediate/advanced/pro), default_lesson_price, notes."
        action={importClientsAction}
        template={CLIENT_TEMPLATE}
      />

      <ImportSection
        title="Horses"
        subtitle="Required: name. Optional: breed, date_of_birth (YYYY-MM-DD), daily_lesson_limit, weekly_lesson_limit, notes."
        action={importHorsesAction}
        template={HORSE_TEMPLATE}
      />
    </div>
  );
}

function ImportSection({
  title,
  subtitle,
  action,
  template,
}: {
  title:    string;
  subtitle: string;
  action:   (prev: ImportState, fd: FormData) => Promise<ImportState>;
  template: string;
}) {
  const [state, dispatch] = useFormState<ImportState, FormData>(action, initial);
  const [csv, setCsv] = useState("");

  return (
    <section className="bg-white rounded-2xl shadow-soft p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-navy-900">{title}</h3>
        <p className="text-[12px] text-ink-500 mt-0.5 leading-relaxed">{subtitle}</p>
      </div>

      <form action={dispatch} className="flex flex-col gap-3">
        <textarea
          name="csv"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={8}
          placeholder={`Paste your CSV here.\n\nFirst row is the header — column names are case-insensitive.`}
          className="
            font-mono text-[12px] tabular-nums
            rounded-xl border border-ink-200 bg-white text-ink-900
            placeholder:text-ink-400 px-3 py-2.5 leading-relaxed
            focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
          "
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setCsv(template)}
            className="h-9 px-3 rounded-xl text-[12px] text-ink-700 hover:bg-ink-100/60"
          >
            Paste sample
          </button>
          <ImportSubmit hasContent={csv.trim().length > 0} />
        </div>

        {/* Error: bubble up server-side parse failures */}
        {state.error && (
          <p className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}

        {/* Result: green when all imported, amber when some skipped */}
        {state.inserted !== null && (
          <div
            className={
              (state.skipped ?? 0) > 0
                ? "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900"
                : "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-900"
            }
          >
            <p className="font-semibold">
              Imported {state.inserted} of {(state.inserted ?? 0) + (state.skipped ?? 0)}.
            </p>
            {(state.skipped ?? 0) > 0 && state.errors && state.errors.length > 0 && (
              <>
                <p className="mt-1 mb-1 opacity-90">Sample errors:</p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {state.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </>
            )}
          </div>
        )}
      </form>
    </section>
  );
}

function ImportSubmit({ hasContent }: { hasContent: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || !hasContent}
      className="
        h-9 px-4 rounded-xl text-[12.5px] font-medium
        bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      "
    >
      {pending ? "Importing…" : "Import"}
    </button>
  );
}
