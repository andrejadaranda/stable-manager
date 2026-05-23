"use server";

// Care request actions invoked from the horse-owner's horse-detail page.
// Both server actions revalidate the detail page (so the new row shows
// up immediately) and the owner inbox (/dashboard/care-requests).

import { revalidatePath } from "next/cache";
import {
  createCareRequest,
  cancelCareRequest,
  type CareRequestType,
  type CareRequestUrgency,
} from "@/services/careRequests";
import { toFriendlyError } from "@/lib/errors/friendly";

export type CareRequestActionState = {
  error: string | null;
  success: boolean;
};

const initial: CareRequestActionState = { error: null, success: false };

const ALLOWED_TYPES: CareRequestType[] =
  ["farrier", "vet", "feed", "equipment", "transport", "other"];
const ALLOWED_URGENCY: CareRequestUrgency[] = ["low", "normal", "high"];

export async function submitCareRequestAction(
  _prev: CareRequestActionState,
  formData: FormData,
): Promise<CareRequestActionState> {
  const horseId = String(formData.get("horse_id") ?? "");
  const rawType = String(formData.get("type") ?? "");
  const rawUrgency = String(formData.get("urgency") ?? "normal");
  const preferredDate = String(formData.get("preferred_date") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!horseId)                                 return { ...initial, error: "Missing horse id." };
  if (!ALLOWED_TYPES.includes(rawType as never)) return { ...initial, error: "Pick a request type." };
  if (!ALLOWED_URGENCY.includes(rawUrgency as never))
                                                return { ...initial, error: "Invalid urgency." };

  try {
    await createCareRequest({
      horseId,
      type:          rawType as CareRequestType,
      urgency:       rawUrgency as CareRequestUrgency,
      preferredDate: preferredDate || null,
      notes:         notes.length > 0 ? notes : null,
    });
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  revalidatePath(`/dashboard/my-horses/${horseId}`);
  revalidatePath("/dashboard/care-requests");
  revalidatePath("/dashboard");
  return { error: null, success: true };
}

export async function cancelCareRequestAction(formData: FormData): Promise<void> {
  const id      = String(formData.get("request_id") ?? "");
  const horseId = String(formData.get("horse_id") ?? "");
  if (!id) return;
  try {
    await cancelCareRequest(id);
  } catch {
    // swallowed — UI shows the row + status; if it remains the user can
    // try again. We avoid throwing here because this fires from a tiny
    // form action and the error surface would just be a generic toast.
  }
  if (horseId) revalidatePath(`/dashboard/my-horses/${horseId}`);
  revalidatePath("/dashboard/care-requests");
  revalidatePath("/dashboard");
}
