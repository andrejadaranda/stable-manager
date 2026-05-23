"use server";

// Owner approves / rejects a stable_join_request.
// Approve goes through approve_join_request RPC which atomically creates
// the clients row; the action then immediately calls sendClientInvite()
// to email the new client an invitation token (reusing the production
// /invite/[token] accept flow + the existing Resend integration).

import { revalidatePath } from "next/cache";
import { approveJoinRequest, rejectJoinRequest } from "@/services/joinRequests";
import { sendClientInvite } from "@/services/invitations";
import { toFriendlyError } from "@/lib/errors/friendly";

export type JoinResponseState = {
  error:    string | null;
  success:  boolean;
  /** True if the invitation email actually went out. False means the
   *  client row was created and the invite token exists, but Resend
   *  was unavailable and the owner needs to copy the link manually
   *  from the client's profile. */
  emailSent?: boolean;
};

const initial: JoinResponseState = { error: null, success: false };

export async function approveJoinAction(
  _prev: JoinResponseState,
  formData: FormData,
): Promise<JoinResponseState> {
  const requestId = String(formData.get("request_id") ?? "");
  if (!requestId) return { ...initial, error: "Missing request id." };

  let newClientId: string;
  try {
    newClientId = await approveJoinRequest(requestId);
  } catch (err) {
    // Temporary verbose log to identify the real failure cause — remove
    // once the approve path is verified end-to-end.
    console.error("[approveJoinAction] approveJoinRequest threw:", err);
    return { ...initial, error: toFriendlyError(err).message };
  }

  // Fire-and-forward invitation. If Resend is down we still return success —
  // the clients row exists and the owner can resend from /dashboard/clients.
  let emailSent = false;
  try {
    const result = await sendClientInvite({ clientId: newClientId });
    emailSent = result.emailSent;
  } catch {
    emailSent = false;
  }

  revalidatePath("/dashboard/join-requests");
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard");
  return { error: null, success: true, emailSent };
}

export async function rejectJoinAction(
  _prev: JoinResponseState,
  formData: FormData,
): Promise<JoinResponseState> {
  const requestId = String(formData.get("request_id") ?? "");
  const reason    = String(formData.get("reason") ?? "").trim();
  if (!requestId) return { ...initial, error: "Missing request id." };

  try {
    await rejectJoinRequest(requestId, reason.length > 0 ? reason : null);
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  revalidatePath("/dashboard/join-requests");
  revalidatePath("/dashboard");
  return { error: null, success: true };
}
