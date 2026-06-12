"use server";

// Client lesson-request server actions.
// Used by the "Request a lesson" sheet on /dashboard/my-lessons AND the
// inline version on /dashboard/my-horses/[id] (pre-filled with horseId).

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import {
  createLessonRequest,
  cancelLessonRequest,
  respondToCounterOffer,
} from "@/services/lessonRequests";
import { toFriendlyError } from "@/lib/errors/friendly";

export type LessonRequestActionState = {
  error: string | null;
  success: boolean;
};

const initial: LessonRequestActionState = { error: null, success: false };

export async function submitLessonRequestAction(
  _prev: LessonRequestActionState,
  formData: FormData,
): Promise<LessonRequestActionState> {
  const session = await getSession().catch(() => null);
  if (!session?.clientId || !session?.stableId) {
    return { ...initial, error: "Sign in as a client to request a lesson." };
  }

  const date     = String(formData.get("date") ?? "");
  const time     = String(formData.get("time") ?? "");
  const horseId  = String(formData.get("horse_id") ?? "");
  const duration = parseInt(String(formData.get("duration") ?? "60"), 10) || 60;
  const notes    = String(formData.get("notes") ?? "").trim();

  if (!date)           return { ...initial, error: "Pick a date." };
  if (!time)           return { ...initial, error: "Pick a time." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
                       return { ...initial, error: "Invalid date." };
  if (!/^\d{2}:\d{2}$/.test(time))
                       return { ...initial, error: "Invalid time." };

  // The client typed wall-clock time in their stable's local TZ
  // (Europe/Vilnius — EEST/EET, DST-aware). We can't use
  // `new Date(local-string)` because that interprets it as the SERVER's
  // local TZ — Vercel runs UTC and would silently shift by 2-3 hours.
  // Compute the actual UTC instant for the given Vilnius wall-clock:
  //   1) parse the string as if it were UTC,
  //   2) ask what Vilnius reads off that UTC moment,
  //   3) the delta is Vilnius's offset, subtract it.
  const asUtc      = new Date(`${date}T${time}:00Z`);
  const vilniusStr = asUtc.toLocaleString("sv-SE", {
    timeZone: "Europe/Vilnius",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const offsetMs = new Date(vilniusStr.replace(" ", "T") + "Z").getTime() - asUtc.getTime();
  const requestedStart = new Date(asUtc.getTime() - offsetMs).toISOString();
  const startMs = new Date(requestedStart).getTime();
  if (!Number.isFinite(startMs) || startMs < Date.now() - 5 * 60 * 1000) {
    return { ...initial, error: "Pick a future date and time." };
  }

  try {
    await createLessonRequest({
      stableId:           session.stableId,
      horseId:            horseId || null,
      requestedStart,
      requestedDuration:  duration,
      notes:              notes.length > 0 ? notes : null,
    });
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  revalidatePath("/dashboard/my-lessons");
  revalidatePath("/dashboard/lesson-requests");
  revalidatePath("/dashboard");
  if (horseId) revalidatePath(`/dashboard/my-horses/${horseId}`);
  return { error: null, success: true };
}

export async function respondCounterAction(formData: FormData): Promise<void> {
  const id     = String(formData.get("request_id") ?? "");
  const accept = String(formData.get("accept") ?? "") === "yes";
  if (!id) return;
  try {
    await respondToCounterOffer(id, accept);
  } catch {
    // soft-swallow; UI re-renders with the row unchanged
  }
  revalidatePath("/dashboard/my-lessons");
  revalidatePath("/dashboard/lesson-requests");
  revalidatePath("/dashboard");
}

export async function cancelLessonRequestAction(formData: FormData): Promise<void> {
  const id      = String(formData.get("request_id") ?? "");
  const horseId = String(formData.get("horse_id") ?? "");
  if (!id) return;
  try {
    await cancelLessonRequest(id);
  } catch {
    // soft-swallow; UI re-renders with the row still present
  }
  revalidatePath("/dashboard/my-lessons");
  revalidatePath("/dashboard/lesson-requests");
  revalidatePath("/dashboard");
  if (horseId) revalidatePath(`/dashboard/my-horses/${horseId}`);
}
