"use server";

// Per-person actions surfaced inside a client's chat thread — the chat is
// the hub: send an invoice into the conversation, or send the person a
// reminder, without leaving Messages.

import { generateInvoiceForClient, sendInvoiceToClient } from "@/services/invoices";
import { createReminder } from "@/services/reminders";
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

/** Send a reminder assigned to this person. */
export async function sendReminderFromChatAction(
  profileId: string,
  body: string,
): Promise<ChatActionState> {
  const text = body.trim();
  if (!text) return { ok: false, message: "Write the reminder first." };
  if (text.length > 500) return { ok: false, message: "Keep the reminder under 500 characters." };
  try {
    await createReminder({ body: text, assignedTo: profileId });
    return { ok: true, message: "Reminder sent." };
  } catch (err) {
    return { ok: false, message: toFriendlyError(err).message };
  }
}
