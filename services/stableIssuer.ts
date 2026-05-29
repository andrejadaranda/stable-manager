// Stable issuer (sąskaitos rekvizitai) — legal name, business code,
// VAT code, address, IBAN, invoice prefix. Without these fields the
// generated invoices are NOT valid LT/EU tax documents.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";

export type StableIssuer = {
  legal_name:       string | null;
  business_code:    string | null;
  vat_code:         string | null;
  business_address: string | null;
  iban:             string | null;
  invoice_prefix:   string;
  next_invoice_seq: number;
};

export async function getStableIssuer(): Promise<StableIssuer> {
  const session = await getSession();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("stables")
    .select("legal_name, business_code, vat_code, business_address, iban, invoice_prefix, next_invoice_seq")
    .eq("id", session.stableId)
    .single();
  if (error) throw error;
  return data as StableIssuer;
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
