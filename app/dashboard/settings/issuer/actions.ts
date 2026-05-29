"use server";

import { revalidatePath } from "next/cache";
import { updateStableIssuer } from "@/services/stableIssuer";

export type IssuerState = { error: string | null; success: boolean };
const initial: IssuerState = { error: null, success: false };

export async function saveIssuerAction(
  _prev: IssuerState,
  fd: FormData,
): Promise<IssuerState> {
  try {
    await updateStableIssuer({
      legal_name:       String(fd.get("legal_name")       ?? ""),
      business_code:    String(fd.get("business_code")    ?? ""),
      vat_code:         String(fd.get("vat_code")         ?? ""),
      business_address: String(fd.get("business_address") ?? ""),
      iban:             String(fd.get("iban")             ?? ""),
      invoice_prefix:   String(fd.get("invoice_prefix")   ?? "INV"),
    });
  } catch (err) {
    const msg = (err as Error)?.message ?? "Failed to save.";
    if (msg === "INVALID_PREFIX") return { ...initial, error: "Prefix must be A-Z, 0-9 or '-', max 12 chars." };
    return { ...initial, error: msg };
  }
  revalidatePath("/dashboard/settings/issuer");
  revalidatePath("/dashboard/finance");
  return { error: null, success: true };
}
