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
    if (code === "INVALID_BODY")    return { ok: false, error: "Žinutė tuščia arba per ilga." };
    if (code === "FORBIDDEN")       return { ok: false, error: "Negali rašyti į šį pokalbį." };
    if (code === "UNAUTHENTICATED") return { ok: false, error: "Sesija pasibaigė. Prisijunk iš naujo." };
    return { ok: false, error: "Nepavyko išsiųsti žinutės." };
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
    if (code === "FORBIDDEN")        return { ok: false, error: "Negali pradėti šio pokalbio." };
    if (code === "INVALID_TARGET")   return { ok: false, error: "Pasirink, kam rašyti." };
    if (code === "UNAUTHENTICATED")  return { ok: false, error: "Sesija pasibaigė. Prisijunk iš naujo." };
    return { ok: false, error: "Nepavyko pradėti pokalbio." };
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
