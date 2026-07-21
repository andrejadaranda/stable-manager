// Stable issuer (sąskaitos rekvizitai) — legal name, business code,
// VAT code, address, IBAN, invoice prefix. Without these fields the
// generated invoices are NOT valid LT/EU tax documents.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";
export { DEFAULT_VAT_BY_COUNTRY, defaultVatForCountry } from "./stableIssuer.pure";

export type StableIssuer = {
  legal_name:       string | null;
  business_code:    string | null;
  vat_code:         string | null;
  business_address: string | null;
  iban:             string | null;
  invoice_prefix:   string;
  next_invoice_seq: number;
  country:          string | null;  // ISO-3166 alpha-2, drives the default VAT rate
  vat_rate:         number;         // applied VAT % on invoices (0 = not a VAT payer)
};

export async function getStableIssuer(): Promise<StableIssuer> {
  const session = await getSession();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("stables")
    .select("legal_name, business_code, vat_code, business_address, iban, invoice_prefix, next_invoice_seq, country, vat_rate")
    .eq("id", session.stableId)
    .single();
  if (error) throw error;
  const row = data as StableIssuer;
  return { ...row, vat_rate: Number(row.vat_rate ?? 0) };
}

/** Required fields: legal_name, business_code, business_address.
 *  VAT code optional (not every stable is a PVM payer). IBAN strongly
 *  recommended but not strictly required (can pay cash). */
export function isIssuerReady(i: StableIssuer): boolean {
  return Boolean(
    i.legal_name?.trim() &&
    i.business_code?.trim() &&
    i.business_address?.trim()
  );
}

export async function updateStableIssuer(input: {
  legal_name?:       string | null;
  business_code?:    string | null;
  vat_code?:         string | null;
  business_address?: string | null;
  iban?:             string | null;
  invoice_prefix?:   string;
  country?:          string | null;
  vat_rate?:         number | null;
}): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner");

  const supabase = createSupabaseServerClient();
  const update: Record<string, unknown> = {};
  if (input.legal_name       !== undefined) update.legal_name       = input.legal_name?.trim() || null;
  if (input.business_code    !== undefined) update.business_code    = input.business_code?.trim() || null;
  if (input.vat_code         !== undefined) update.vat_code         = input.vat_code?.trim() || null;
  if (input.business_address !== undefined) update.business_address = input.business_address?.trim() || null;
  if (input.iban             !== undefined) update.iban             = input.iban?.trim().replace(/\s+/g, "") || null;
  if (input.country          !== undefined) update.country          = input.country?.trim().toUpperCase() || null;
  if (input.vat_rate         !== undefined) {
    const r = Number(input.vat_rate);
    if (!Number.isFinite(r) || r < 0 || r > 100) throw new Error("INVALID_VAT_RATE");
    update.vat_rate = r;
  }
  if (input.invoice_prefix   !== undefined) {
    const p = input.invoice_prefix.trim().toUpperCase();
    if (!/^[A-Z0-9-]{1,12}$/.test(p)) throw new Error("INVALID_PREFIX");
    update.invoice_prefix = p;
  }

  const { error } = await supabase
    .from("stables")
    .update(update)
    .eq("id", session.stableId);

  if (error) throw error;
}
