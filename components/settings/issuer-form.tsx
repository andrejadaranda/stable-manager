"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import {
  saveIssuerAction,
  type IssuerState,
} from "@/app/dashboard/settings/issuer/actions";
import type { StableIssuer } from "@/services/stableIssuer";

const initial: IssuerState = { error: null, success: false };

export function IssuerForm({ initial: issuer }: { initial: StableIssuer }) {
  const [state, dispatch] = useFormState<IssuerState, FormData>(saveIssuerAction, initial);

  return (
    <form action={dispatch} className="bg-white rounded-2xl shadow-soft p-5 flex flex-col gap-4">
      {/* Legal name (required) */}
      <Field
        label="Legal name (juridinis pavadinimas)"
        name="legal_name"
        defaultValue={issuer.legal_name ?? ""}
        required
        placeholder='UAB "Žirgų klubas" or first+last name for individual activity'
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Business code (įmonės arba individualios veiklos kodas)"
          name="business_code"
          defaultValue={issuer.business_code ?? ""}
          required
          placeholder="e.g. 123456789 or 123456789 individuali veikla"
        />
        <Field
          label="VAT code (PVM mokėtojo kodas) — optional"
          name="vat_code"
          defaultValue={issuer.vat_code ?? ""}
          placeholder="LT123456789"
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
          placeholder="LT00 0000 0000 0000 0000"
        />
        <Field
          label="Invoice number prefix"
          name="invoice_prefix"
          defaultValue={issuer.invoice_prefix ?? "INV"}
          placeholder="INV"
          help={`Next number: ${issuer.invoice_prefix}${String(issuer.next_invoice_seq).padStart(4, "0")}`}
        />
      </div>

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
