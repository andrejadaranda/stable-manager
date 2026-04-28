"use server";

// Chat server actions. Thin wrappers over services/chat.ts that
// translate clean error tokens into user-facing strings and
// trigger router cache invalidation where needed.
//
// IMPORTANT: every action call goes through getSession() inside the
// service, so RLS and role gates are always enforced.

import { revalidatePath } from "next/cache";
import {
  sendChatMessage,
  startDirectChat,
  markThreadRead,
  getAvailableChatContacts,
  type ChatMessageRow,
  type ChatContact,
} from "@/services/chat";

export type SendMessageResult =
  | { ok: true; message: ChatMessageRow }
  | { ok: false; error: string };

export async function sendMessageAction(
  threadId: string,
  body: string,
): Promise<SendMessageResult> {
  try {
    const message = await sendChatMessage(threadId, body);
    revalidatePath("/dashboard/chat");
    return { ok: true, message };
  } catch (err: any) {
    const code = err?.message ?? "";
    if (code === "INVALID_BODY")    return { ok: false, error: "Message is empty or too long." };
    if (code === "FORBIDDEN")       return { ok: false, error: "You can't post in this conversation." };
    if (code === "UNAUTHENTICATED") return { ok: false, error: "Your session expired. Sign in again." };
    return { ok: false, error: "Couldn't send the message." };
  }
}

export type StartDirectChatResult =
  | { ok: true; threadId: string }
  | { ok: false; error: string };

export async function startDirectChatAction(
  targetProfileId: string,
): Promise<StartDirectChatResult> {
  try {
    const threadId = await startDirectChat(targetProfileId);
    revalidatePath("/dashboard/chat");
    return { ok: true, threadId };
  } catch (err: any) {
    const code = err?.message ?? "";
    if (code === "FORBIDDEN")        return { ok: false, error: "You can't start this conversation." };
    if (code === "INVALID_TARGET")   return { ok: false, error: "Pick someone to message." };
    if (code === "UNAUTHENTICATED")  return { ok: false, error: "Your session expired. Sign in again." };
    return { ok: false, error: "Couldn't start the conversation." };
  }
}

export async function markReadAction(threadId: string): Promise<void> {
  try {
    await markThreadRead(threadId);
  } catch {
    // Read marker is best-effort; never block the UI on it.
  }
}

export async function listContactsAction(): Promise<ChatContact[]> {
  try {
    return await getAvailableChatContacts();
  } catch {
    return [];
  }
}
