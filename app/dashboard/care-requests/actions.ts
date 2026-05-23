"use server";

// Owner / employee respond to a care request.
// Returns void — owner inbox uses progressive enhancement (form action +
// revalidatePath), no inline status state required.

import { revalidatePath } from "next/cache";
import {
  respondToCareRequest,
  type CareRequestStatus,
} from "@/services/careRequests";

type RespondStatus = Exclude<CareRequestStatus, "pending">;
const ALLOWED: RespondStatus[] = ["acknowledged", "scheduled", "done", "declined"];

function isAllowedStatus(s: string): s is RespondStatus {
  return (ALLOWED as string[]).includes(s);
}

export async function respondCareRequestAction(formData: FormData): Promise<void> {
  const requestId    = String(formData.get("request_id") ?? "");
  const statusRaw    = String(formData.get("status") ?? "");
  const response     = String(formData.get("response") ?? "");
  const scheduledFor = String(formData.get("scheduled_for") ?? "");

  if (!requestId)                  return;
  if (!isAllowedStatus(statusRaw)) return;

  try {
    await respondToCareRequest({
      requestId,
      status:       statusRaw,
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
