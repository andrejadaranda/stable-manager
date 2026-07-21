"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  saveIssuerAction,
  type IssuerState,
} from "@/app/dashboard/settings/issuer/actions";
import type { StableIssuer } from "@/services/stableIssuer";
import { COUNTRY_LABELS, defaultVatForCountry } from "@/services/stableIssuer.pure";

const initial: IssuerState = { error: null, success: false };

export function IssuerForm({ initial: issuer }: { initial: StableIssuer }) {
  const [state, dispatch] = useFormState<IssuerState, FormData>(saveIssuerAction, initial);

  return (
    <form action={dispatch} className="bg-white rounded-2xl shadow-soft p-5 flex flex-col gap-4">
      {/* Legal name (required) */}
      <Field
        label="Legal name"
        name="legal_name"
        defaultValue={issuer.legal_name ?? ""}
        required
        placeholder="Registered company or sole-trader name"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Company / registration number"
          name="business_code"
          defaultValue={issuer.business_code ?? ""}
          required
          placeholder="e.g. 123456789"
        />
        <Field
          label="VAT number — optional"
          name="vat_code"
          defaultValue={issuer.vat_code ?? ""}
          placeholder="e.g. DE123456789"
        />
      </div>

      <Field
        label="Address"
        name="business_address"
        defaultValue={issuer.business_address ?? ""}
        required
        placeholder="Street, House nr., City, Postal code, Country"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="IBAN (recommended)"
          name="iban"
          defaultValue={issuer.iban ?? ""}
          placeholder="e.g. DE00 0000 0000 0000 0000"
        />
        <Field
          label="Invoice number prefix"
          name="invoice_prefix"
          defaultValue={issuer.invoice_prefix ?? "INV"}
          placeholder="INV"
          help={`Next number: ${issuer.invoice_prefix}${String(issuer.next_invoice_seq).padStart(4, "0")}`}
        />
      </div>

      <TaxFields
        initialCountry={issuer.country ?? ""}
        initialVat={issuer.vat_rate ?? 0}
      />

      {state.error && (
        <p className="rounded-lg bg-rose-50 border border-rose-200 text-rose-800 px-3 py-2 text-[13px]">
          {state.error}
        </p>
      )}
      {state.success && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 px-3 py-2.5 text-[13px] flex items-center justify-between gap-3 flex-wrap">
          <span><strong>Saved.</strong> Bulk invoice generation is now enabled.</span>
          <Link
            href="/dashboard/finance/invoices"
            className="h-8 px-3 inline-flex items-center rounded-lg bg-emerald-700 text-white text-[12px] font-medium hover:bg-emerald-800"
          >
            Generate invoices now →
          </Link>
        </div>
      )}

      <div className="flex justify-end">
        <SaveButton />
      </div>
    </form>
  );
}

// Country + VAT rate. Picking a country pre-fills the standard rate; the owner
// can still override it. Both post as form fields (country, vat_rate).
function TaxFields({ initialCountry, initialVat }: { initialCountry: string; initialVat: number }) {
  const [country, setCountry] = useState(initialCountry);
  const [vat, setVat] = useState(String(initialVat ?? 0));
  const codes = Object.keys(COUNTRY_LABELS);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[12px] font-medium text-ink-700">Country</span>
        <select
          name="country"
          value={country}
          onChange={(e) => {
            const code = e.target.value;
            setCountry(code);
            // Pre-fill the standard rate for the chosen country.
            setVat(String(defaultVatForCountry(code)));
          }}
          className="h-10 rounded-xl border border-ink-200 bg-white text-sm text-ink-900 px-3 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        >
          <option value="">Select country…</option>
          {codes.map((c) => (
            <option key={c} value={c}>{COUNTRY_LABELS[c]}</option>
          ))}
        </select>
        <span className="text-[11px] text-ink-500 mt-0.5">Sets the default VAT rate for your invoices.</span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[12px] font-medium text-ink-700">VAT rate · %</span>
        <input
          name="vat_rate"
          type="number"
          min="0"
          max="100"
          step="0.5"
          value={vat}
          onChange={(e) => setVat(e.target.value)}
          placeholder="0"
          className="h-10 rounded-xl border border-ink-200 bg-white text-sm text-ink-900 px-3 tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        />
        <span className="text-[11px] text-ink-500 mt-0.5">0 if you&apos;re not a VAT payer. Override the default if needed.</span>
      </label>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
  placeholder,
  help,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  help?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-[12px] font-medium text-ink-700">
        {label} {required && <span className="text-rose-600">*</span>}
      </span>
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        className="
          h-10 rounded-xl border border-ink-200 bg-white text-sm text-ink-900
          placeholder:text-ink-400 px-3
          focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
        "
      />
      {help && <span className="text-[11px] text-ink-500 mt-0.5">{help}</span>}
    </label>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 px-4 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save issuer details"}
    </button>
  );
}
