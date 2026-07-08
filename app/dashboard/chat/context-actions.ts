"use server";

// Per-person actions surfaced inside a client's chat thread — the chat is
// the hub: send an invoice into the conversation, or send the person a
// reminder, without leaving Messages.

import { generateInvoiceForClient, createCustomInvoiceForClient, sendInvoiceToClient } from "@/services/invoices";
import { createReminder, setReminderCompleted, deleteReminder } from "@/services/reminders";
import { respondToCareRequest } from "@/services/careRequests";
import { declineLessonRequest } from "@/services/lessonRequests";
import { toFriendlyError } from "@/lib/errors/friendly";

export type ChatActionState = { ok: boolean; message: string };

/** Generate an invoice covering the client's outstanding items and post it
 *  into this conversation (in-app chat delivery). */
export async function sendInvoiceFromChatAction(clientId: string): Promise<ChatActionState> {
  try {
    const { id } = await generateInvoiceForClient(clientId);
    if (!id) {
      return { ok: false, message: "Nothing outstanding to invoice right now." };
    }
    await sendInvoiceToClient(id, { email: false, chat: true });
    return { ok: true, message: "Invoice sent to this conversation." };
  } catch (err) {
    return { ok: false, message: toFriendlyError(err).message };
  }
}

/** Create a one-line custom invoice (service + amount) and post it into the
 *  conversation. */
export async function sendCustomInvoiceFromChatAction(
  clientId: string,
  description: string,
  amount: number,
): Promise<ChatActionState> {
  if (!description.trim()) return { ok: false, message: "Add a short description." };
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return { ok: false, message: "Enter an amount over €0." };
  try {
    const { id } = await createCustomInvoiceForClient(clientId, description, amt);
    await sendInvoiceToClient(id, { email: false, chat: true });
    return { ok: true, message: "Invoice sent to this conversation." };
  } catch (err) {
    return { ok: false, message: toFriendlyError(err).message };
  }
}

/** Send a reminder assigned to this person. */
export async function sendReminderFromChatAction(
  profileId: string,
  body: string,
): Promise<ChatActionState> {
  const text = body.trim();
  if (!text) return { ok: false, message: "Write the reminder first." };
  if (text.length > 500) return { ok: false, message: "Keep the reminder under 500 characters." };
  try {
    // Create an interactive reminder assigned to the person. It renders as a
    // card in the conversation (with a Complete action) — not a plain message.
    await createReminder({ body: text, assignedTo: profileId });
    return { ok: true, message: "Reminder added." };
  } catch (err) {
    return { ok: false, message: toFriendlyError(err).message };
  }
}

/** Mark a reminder complete from the conversation. */
export async function completeReminderFromChatAction(reminderId: string): Promise<ChatActionState> {
  try {
    await setReminderCompleted(reminderId, new Date().toISOString());
    return { ok: true, message: "Reminder completed." };
  } catch (err) {
    return { ok: false, message: toFriendlyError(err).message };
  }
}

/** Delete a reminder from the conversation. */
export async function deleteReminderFromChatAction(reminderId: string): Promise<ChatActionState> {
  try {
    await deleteReminder(reminderId);
    return { ok: true, message: "Reminder removed." };
  } catch (err) {
    return { ok: false, message: toFriendlyError(err).message };
  }
}

// ---- Inline request actions (act on a person's requests in the chat) ----

/** Acknowledge a care request (farrier/vet/feed/etc.) right in the thread. */
export async function acknowledgeCareRequestAction(id: string): Promise<ChatActionState> {
  try {
    await respondToCareRequest({ requestId: id, status: "acknowledged" });
    return { ok: true, message: "Marked acknowledged." };
  } catch (err) {
    return { ok: false, message: toFriendlyError(err).message };
  }
}

/** Decline a care request. */
export async function declineCareRequestAction(id: string): Promise<ChatActionState> {
  try {
    await respondToCareRequest({ requestId: id, status: "declined" });
    return { ok: true, message: "Request declined." };
  } catch (err) {
    return { ok: false, message: toFriendlyError(err).message };
  }
}

/** Decline a lesson request. (Accepting needs the scheduling dialog — that
 *  stays in the inbox/calendar flow via the "Schedule" link.) */
export async function declineLessonRequestAction(id: string): Promise<ChatActionState> {
  try {
    await declineLessonRequest(id);
    return { ok: true, message: "Lesson request declined." };
  } catch (err) {
    return { ok: false, message: toFriendlyError(err).message };
  }
}
