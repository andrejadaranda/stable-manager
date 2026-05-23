"use server";

// Owner / employee respond to a care request.
// Returns void — owner inbox uses progressive enhancement (form action +
// revalidatePath), no inline status state required.

import { revalidatePath } from "next/cache";
import {
  respondToCareRequest,
  type CareRequestStatus,
} from "@/services/careRequests";

const ALLOWED: CareRequestStatus[] = ["acknowledged", "scheduled", "done", "declined"];

export async function respondCareRequestAction(formData: FormData): Promise<void> {
  const requestId    = String(formData.get("request_id") ?? "");
  const status       = String(formData.get("status") ?? "") as CareRequestStatus;
  const response     = String(formData.get("response") ?? "");
  const scheduledFor = String(formData.get("scheduled_for") ?? "");

  if (!requestId)                  return;
  if (!ALLOWED.includes(status))   return;

  try {
    await respondToCareRequest({
      requestId,
      status,
      response:     response.length > 0 ? response : null,
      scheduledFor: scheduledFor || null,
    });
  } catch {
    // swallow — inbox re-renders, owner can retry. We avoid throwing
    // here so a small form action doesn't blow up the page.
  }

  revalidatePath("/dashboard/care-requests");
  revalidatePath("/dashboard");
}
