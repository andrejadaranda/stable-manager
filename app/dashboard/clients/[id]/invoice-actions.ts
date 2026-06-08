"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generateInvoiceForClient } from "@/services/invoices";

/** Generate a real, numbered finance invoice for this client from their
 *  outstanding items, then jump to it (branded + printable + listed on the
 *  Invoices page). Replaces the old ad-hoc client-profile invoice preview. */
export async function generateClientInvoiceAction(fd: FormData): Promise<void> {
  const clientId = String(fd.get("client_id") ?? "");
  if (!clientId) return;

  let target: string;
  try {
    const { id } = await generateInvoiceForClient(clientId);
    target = id
      ? `/dashboard/finance/invoices/${id}`
      : `/dashboard/finance/invoices`; // nothing outstanding → show the list
  } catch {
    target = `/dashboard/finance/invoices`;
  }

  revalidatePath("/dashboard/finance/invoices");
  redirect(target);
}
