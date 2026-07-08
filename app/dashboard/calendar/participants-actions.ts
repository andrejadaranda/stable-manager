"use server";

// Server actions wrapping services/lessons.ts group-lesson APIs.
// Keeps the calendar UI components free of supabase imports.

import { revalidatePath } from "next/cache";
import {
  addLessonParticipant,
  addNewChildToLesson,
  removeLessonParticipant,
  setLessonCapacity,
  setLessonParticipantPrice,
  listLessonParticipants,
  promoteFromWaitlist,
} from "@/services/lessons";

export type ParticipantsActionState = {
  error: string | null;
  success: boolean;
};

const initial: ParticipantsActionState = { error: null, success: false };

export async function addParticipantAction(
  _prev: ParticipantsActionState,
  fd: FormData,
): Promise<ParticipantsActionState> {
  const lessonId = String(fd.get("lesson_id") ?? "");
  const clientId = String(fd.get("client_id") ?? "");
  const newChildName = String(fd.get("new_child_name") ?? "").trim();
  const horseId  = String(fd.get("horse_id")  ?? "");
  const priceRaw = String(fd.get("price") ?? "").trim();
  const price = priceRaw ? Number(priceRaw) : undefined;
  const waitlist = String(fd.get("waitlist")  ?? "") === "1";

  if (!lessonId) return { ...initial, error: "Missing lesson." };

  // New child typed inline — create them (linked to the lesson's parent) and
  // attach with a price. Horse is optional.
  if (!clientId && newChildName) {
    const r = await addNewChildToLesson(lessonId, newChildName, { horseId: horseId || null, price });
    if (!r.ok) {
      if (r.reason === "HORSE_DOUBLE_BOOKED") return { ...initial, error: "That horse already has a lesson at this time." };
      return { ...initial, error: r.reason };
    }
    revalidatePath("/dashboard/calendar");
    return { error: null, success: true };
  }

  if (!clientId) return { ...initial, error: "Pick a rider or add a new child." };

  const result = await addLessonParticipant(lessonId, clientId, horseId || null, { forceWaitlist: waitlist });
  if (!result.ok) {
    if (result.reason === "LESSON_FULL")              return { ...initial, error: "Lesson is full." };
    if (result.reason === "HORSE_DOUBLE_BOOKED")      return { ...initial, error: "That horse already has a lesson at this time." };
    if (result.reason === "CLIENT_ALREADY_IN_LESSON") return { ...initial, error: "Rider is already in this lesson." };
    return { ...initial, error: result.reason };
  }

  if (price !== undefined && Number.isFinite(price) && price >= 0) {
    try { await setLessonParticipantPrice(lessonId, clientId, price); } catch { /* price is non-fatal */ }
  }

  revalidatePath("/dashboard/calendar");
  return { error: null, success: true };
}

export async function promoteWaitlistAction(
  _prev: ParticipantsActionState,
  fd: FormData,
): Promise<ParticipantsActionState> {
  const lessonId = String(fd.get("lesson_id") ?? "");
  const clientId = String(fd.get("client_id") ?? "");
  if (!lessonId || !clientId) return { ...initial, error: "Missing rider." };

  const result = await promoteFromWaitlist(lessonId, clientId);
  if (!result.ok) {
    if (result.reason === "LESSON_FULL") return { ...initial, error: "Lesson is full — remove someone or raise capacity first." };
    if (result.reason === "HORSE_DOUBLE_BOOKED") return { ...initial, error: "Promote blocked: horse conflicts at that time." };
    return { ...initial, error: result.reason };
  }

  revalidatePath("/dashboard/calendar");
  return { error: null, success: true };
}

export async function removeParticipantAction(
  _prev: ParticipantsActionState,
  fd: FormData,
): Promise<ParticipantsActionState> {
  const lessonId = String(fd.get("lesson_id") ?? "");
  const clientId = String(fd.get("client_id") ?? "");

  if (!lessonId || !clientId) {
    return { ...initial, error: "Missing rider." };
  }

  try {
    await removeLessonParticipant(lessonId, clientId);
  } catch (err) {
    const msg = (err as Error)?.message ?? "Failed to remove rider.";
    if (msg === "CANNOT_REMOVE_LAST_PARTICIPANT") {
      return { ...initial, error: "Cancel the whole lesson instead of removing the last rider." };
    }
    return { ...initial, error: msg };
  }

  revalidatePath("/dashboard/calendar");
  return { error: null, success: true };
}

export async function setCapacityAction(
  _prev: ParticipantsActionState,
  fd: FormData,
): Promise<ParticipantsActionState> {
  const lessonId = String(fd.get("lesson_id") ?? "");
  const cap      = Number(fd.get("max_participants") ?? "1");

  if (!lessonId || !Number.isFinite(cap)) {
    return { ...initial, error: "Invalid capacity." };
  }

  try {
    await setLessonCapacity(lessonId, cap);
  } catch (err) {
    return { ...initial, error: (err as Error)?.message ?? "Failed to set capacity." };
  }

  revalidatePath("/dashboard/calendar");
  return { error: null, success: true };
}

export async function setParticipantPriceAction(
  _prev: ParticipantsActionState,
  fd: FormData,
): Promise<ParticipantsActionState> {
  const lessonId = String(fd.get("lesson_id") ?? "");
  const clientId = String(fd.get("client_id") ?? "");
  const price    = Number(fd.get("price") ?? "0");
  if (!lessonId || !clientId) return { ...initial, error: "Missing rider." };
  if (!Number.isFinite(price) || price < 0) return { ...initial, error: "Price must be 0 or more." };

  try {
    await setLessonParticipantPrice(lessonId, clientId, price);
  } catch (err) {
    return { ...initial, error: (err as Error)?.message ?? "Failed to set price." };
  }

  revalidatePath("/dashboard/calendar");
  return { error: null, success: true };
}

/** Server-side loader for the participants panel. Called from a client
 *  component via useEffect → fetch wrapper isn't ideal but it keeps the
 *  panel rendering self-contained inside the existing edit dialog. */
export async function loadParticipants(lessonId: string) {
  if (!lessonId) return [];
  return listLessonParticipants(lessonId);
}
