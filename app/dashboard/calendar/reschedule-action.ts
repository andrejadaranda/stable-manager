"use server";

// Drag-to-reschedule server action. Preserves duration; only the start
// time changes (the calendar shell sends the new start as a local
// "YYYY-MM-DDTHH:mm" string). Welfare cap + conflict checks reuse the
// existing updateLesson preflight, so dragging into an already-booked
// slot or onto an overworked horse fails with the same error code.

import { revalidatePath } from "next/cache";
import { updateLesson } from "@/services/lessons";
import { toFriendlyError } from "@/lib/errors/friendly";

export type RescheduleResult = {
  ok: boolean;
  /** Friendly error message when ok=false. */
  error: string | null;
};

export async function rescheduleLessonAction(formData: FormData): Promise<RescheduleResult> {
  const lessonId = String(formData.get("lesson_id") ?? "");
  const startsAt = String(formData.get("starts_at") ?? "");
  const endsAt   = String(formData.get("ends_at")   ?? "");
  if (!lessonId || !startsAt || !endsAt) {
    return { ok: false, error: "Missing reschedule details." };
  }
  try {
    await updateLesson(lessonId, { startsAt, endsAt });
    revalidatePath("/dashboard/calendar");
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: toFriendlyError(err).message };
  }
}
