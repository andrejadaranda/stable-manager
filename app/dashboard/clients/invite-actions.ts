"use server";

// Server actions powering the "Invite to app" button on the client
// list + client detail page. Owner-only — service-layer enforces.

import { revalidatePath } from "next/cache";
import {
  sendClientInvite,
  revokeInvitation,
} from "@/services/invitations";

export type InviteActionState = {
  error:   string | null;
  /** When set, contains the invite URL — UI surfaces a "Copy link"
   *  control so the owner can hand-share if the email bounced. */
  link:    string | null;
  /** Whether the email actually went out. False = link generated but
   *  Resend failed; the UI hints the owner to copy + share manually. */
  emailed: boolean;
};

const initial: InviteActionState = { error: null, link: null, emailed: false };

export async function sendInviteAction(
  _prev: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const clientId   = String(formData.get("client_id") ?? "");
  const emailOverride = String(formData.get("email") ?? "").trim();

  if (!clientId) return { ...initial, error: "Missing client id." };

  try {
    const result = await sendClientInvite({
      clientId,
      email: emailOverride || undefined,
    });
    revalidatePath(`/dashboard/clients/${clientId}`);
    revalidatePath("/dashboard/clients");
    return {
      error:   null,
      link:    result.invitation.invite_url,
      emailed: result.emailSent,
    };
  } catch (err: any) {
    const message = err?.message ?? "";
    if (message === "CLIENT_ALREADY_LINKED") {
      return {
        ...initial,
        error: "This client already has a portal account — no need to reinvite.",
      };
    }
    if (message === "INVITE_EMAIL_MISSING") {
      return {
        ...initial,
        error: "Add an email to the client first — invites need one to send.",
      };
    }
    if (message === "CLIENT_NOT_FOUND") {
      return { ...initial, error: "Client not found." };
    }
    if (message === "FORBIDDEN") {
      return { ...initial, error: "Only owners can send invites." };
    }
    return { ...initial, error: `Could not send invite: ${message || "unknown error"}.` };
  }
}

export async function revokeInviteAction(
  _prev: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const invitationId = String(formData.get("invitation_id") ?? "");
  const clientId     = String(formData.get("client_id") ?? "");
  if (!invitationId) return { ...initial, error: "Missing invitation id." };

  try {
    await revokeInvitation(invitationId);
    if (clientId) {
      revalidatePath(`/dashboard/clients/${clientId}`);
    }
    revalidatePath("/dashboard/clients");
    return { ...initial };
  } catch (err: any) {
    const message = err?.message ?? "";
    if (message === "FORBIDDEN") {
      return { ...initial, error: "Only owners can revoke invites." };
    }
    return { ...initial, error: `Could not revoke: ${message || "unknown error"}.` };
  }
}
