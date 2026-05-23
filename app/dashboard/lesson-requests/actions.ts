"use server";

// Owner / employee responses on lesson_requests.
// Accept goes through the SECURITY DEFINER RPC which inserts a real
// lessons row (and gets the existing overlap / daily / weekly triggers
// for free). Decline writes the reason via the matching RPC.

import { revalidatePath } from "next/cache";
import {
  acceptLessonRequest,
  declineLessonRequest,
} from "@/services/lessonRequests";
import { toFriendlyError } from "@/lib/errors/friendly";

export type LessonRequestResponseState = {
  error: string | null;
  success: boolean;
};

const initial: LessonRequestResponseState = { error: null, success: false };

export async function acceptLessonRequestAction(
  _prev: LessonRequestResponseState,
  formData: FormData,
): Promise<LessonRequestResponseState> {
  const requestId = String(formData.get("request_id") ?? "");
  const horseId   = String(formData.get("horse_id") ?? "");
  const trainerId = String(formData.get("trainer_id") ?? "");
  const date      = String(formData.get("date") ?? "");
  const time      = String(formData.get("time") ?? "");
  const duration  = parseInt(String(formData.get("duration") ?? "60"), 10) || 60;
  const price     = parseFloat(String(formData.get("price") ?? "0")) || 0;

  if (!requestId) return { ...initial, error: "Missing request id." };
  if (!horseId)   return { ...initial, error: "Pick a horse." };
  if (!trainerId) return { ...initial, error: "Pick a trainer." };
  if (!date || !time) return { ...initial, error: "Pick date and time." };

  const startsAt = new Date(`${date}T${time}:00`).toISOString();
  if (!Number.isFinite(new Date(startsAt).getTime())) {
    return { ...initial, error: "Invalid date / time." };
  }

  try {
    await acceptLessonRequest({
      requestId,
      horseId,
      trainerId,
      startsAt,
      duration,
      price,
    });
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  revalidatePath("/dashboard/lesson-requests");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  return { error: null, success: true };
}

export async function declineLessonRequestAction(
  _prev: LessonRequestResponseState,
  formData: FormData,
): Promise<LessonRequestResponseState> {
  const requestId = String(formData.get("request_id") ?? "");
  const reason    = String(formData.get("reason") ?? "").trim();

  if (!requestId) return { ...initial, error: "Missing request id." };

  try {
    await declineLessonRequest(requestId, reason.length > 0 ? reason : null);
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  revalidatePath("/dashboard/lesson-requests");
  revalidatePath("/dashboard");
  return { error: null, success: true };
}
