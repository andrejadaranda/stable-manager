"use server";

// One-click "pay from credit" on the client profile. The owner taps a single
// owed item (lesson / misc charge / boarding month) and the client's account
// credit — including work-for-credit (barter) — is applied to it in one go,
// with no need to open each lesson. Applies exactly min(owed, available) so a
// tap can never overpay an item or overspend the credit pool.

import { revalidatePath } from "next/cache";
import { addPayment, getClientAvailableCredit, listClientOwedItems } from "@/services/payments";
import { toFriendlyError } from "@/lib/errors/friendly";

export type CreditActionState = { error: string | null; success: boolean; applied?: number };
const initial: CreditActionState = { error: null, success: false };

export async function applyCreditToOwedAction(
  _prev: CreditActionState,
  formData: FormData,
): Promise<CreditActionState> {
  const clientId = String(formData.get("client_id") ?? "");
  const kind     = String(formData.get("kind") ?? "");      // lesson | charge | boarding
  const itemId   = String(formData.get("item_id") ?? "");

  if (!clientId || !itemId) return { ...initial, error: "Missing item." };
  if (!["lesson", "charge", "boarding"].includes(kind)) {
    return { ...initial, error: "Unknown item type." };
  }

  try {
    // Recompute both sides server-side so the applied amount is always
    // correct even if the page the owner tapped was slightly stale.
    const [available, owedItems] = await Promise.all([
      getClientAvailableCredit(clientId),
      listClientOwedItems(clientId),
    ]);
    const item = owedItems.find((i) => i.kind === kind && i.id === itemId);
    if (!item) return { ...initial, error: "That item is already settled." };

    const apply = Math.min(item.owed, available);
    if (apply <= 0) {
      return {
        ...initial,
        error: available <= 0 ? "No account credit available to apply." : "Nothing left owed on this item.",
      };
    }

    await addPayment({
      clientId,
      amount: Math.round(apply * 100) / 100,
      method: "credit",
      lessonId:         kind === "lesson"   ? itemId : null,
      clientChargeId:   kind === "charge"   ? itemId : null,
      boardingChargeId: kind === "boarding" ? itemId : null,
      notes: "Paid from account credit",
    });

    revalidatePath(`/dashboard/clients/${clientId}`);
    return { error: null, success: true, applied: Math.round(apply * 100) / 100 };
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }
}
