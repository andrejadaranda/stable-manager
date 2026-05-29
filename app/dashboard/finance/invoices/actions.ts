"use server";

import { revalidatePath } from "next/cache";
import {
  generateMonthlyInvoices,
  previewMonthlyInvoices,
  type GenerateResult,
  type GeneratePreview,
} from "@/services/invoices";

export type InvoicesActionState = {
  error:   string | null;
  result:  GenerateResult | null;
};

const initial: InvoicesActionState = { error: null, result: null };

/** Server-side preview for the confirm dialog. Read-only. */
export async function getGeneratePreview(period: string): Promise<GeneratePreview | { error: string }> {
  if (!/^\d{4}-\d{2}$/.test(period)) return { error: "Invalid period." };
  const [y, m] = period.split("-").map((s) => Number(s));
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0)).toISOString();
  const end   = new Date(Date.UTC(y, m,     0, 23, 59, 59)).toISOString();
  try {
    return await previewMonthlyInvoices(start, end);
  } catch (err) {
    return { error: (err as Error)?.message ?? "Preview failed." };
  }
}

/** Generate invoices for the period passed in (YYYY-MM). The period
 *  spans the first to the last day of that month inclusive. */
export async function bulkGenerateAction(
  _prev: InvoicesActionState,
  fd: FormData,
): Promise<InvoicesActionState> {
  const period = String(fd.get("period") ?? "");
  if (!/^\d{4}-\d{2}$/.test(period)) {
    return { ...initial, error: "Invalid period (expected YYYY-MM)." };
  }

  // Build [first day 00:00, last day 23:59:59] ISO range.
  const [y, m] = period.split("-").map((s) => Number(s));
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0)).toISOString();
  const end   = new Date(Date.UTC(y, m,     0, 23, 59, 59)).toISOString();

  try {
    const result = await generateMonthlyInvoices(start, end);
    if (result.warning === "ISSUER_NOT_READY") {
      return {
        error:  "Fill in issuer details (Settings → Issuer) before generating invoices.",
        result: null,
      };
    }
    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard/finance/invoices");
    return { error: null, result };
  } catch (err) {
    return { error: (err as Error)?.message ?? "Generation failed.", result: null };
  }
}
