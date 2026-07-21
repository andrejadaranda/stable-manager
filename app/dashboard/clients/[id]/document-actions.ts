"use server";

import { revalidatePath } from "next/cache";
import { generateClientDocuments, type GeneratedDocuments } from "@/services/documents";

export type GenerateDocsState = {
  error: string | null;
  result: GeneratedDocuments | null;
};

/** Current month as YYYY-MM in Europe/Vilnius. */
function currentYearMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Vilnius", year: "numeric", month: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "2026";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${y}-${m}`;
}

export async function generateClientDocumentsAction(
  _prev: GenerateDocsState,
  fd: FormData,
): Promise<GenerateDocsState> {
  const clientId = String(fd.get("client_id") ?? "");
  const yearMonth = String(fd.get("year_month") ?? "") || currentYearMonth();
  if (!clientId) return { error: "Missing client.", result: null };

  try {
    const result = await generateClientDocuments(clientId, yearMonth);
    if (!result.invoiceId && !result.proformaId) {
      return { error: "Nothing to bill for this month.", result: null };
    }
    revalidatePath(`/dashboard/clients/${clientId}`);
    revalidatePath("/dashboard/finance/invoices");
    return { error: null, result };
  } catch (err) {
    const m = (err as Error)?.message ?? "";
    if (m === "ISSUER_NOT_READY") {
      return { error: "Add your invoice details first (Settings → Issuer).", result: null };
    }
    return { error: `Could not generate: ${m || "unknown error"}.`, result: null };
  }
}
