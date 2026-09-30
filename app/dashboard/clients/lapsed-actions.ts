"use server";

// Dismiss / restore a client on the "haven't been in for 2+ weeks" list.
// Owner-only (enforced in the service + RLS).

import { revalidatePath } from "next/cache";
import { setClientReactivationDismissed } from "@/services/clients";

export async function dismissLapsedClientAction(clientId: string): Promise<{ ok: boolean }> {
  if (!clientId) return { ok: false };
  try {
    await setClientReactivationDismissed(clientId, true);
  } catch {
    return { ok: false };
  }
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard");
  return { ok: true };
}
