"use server";

// =============================================================
// Accept-invite server action.
//
// Anonymous (the recipient isn't a Supabase auth.user yet). The flow:
//   1. Re-lookup token to confirm it's still valid (TOCTOU defence).
//   2. Create the auth.user with the chosen password, email-confirmed.
//   3. Call accept_client_invitation RPC — atomically marks the invite
//      used, creates the profiles row in the inviter's stable as
//      role=client, and links clients.profile_id.
//   4. Redirect to /login (the new user signs in with their new pwd).
//
// We don't auto-sign-in after accept because Supabase server-side
// sign-in from a Server Action is gnarly (cookie handoff edge cases).
// Fresh login keeps the cookie path identical to every other login.
// =============================================================

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  lookupInviteByToken,
  acceptInviteAndCreateProfile,
} from "@/services/invitations";

export type AcceptInviteState = {
  error: string | null;
};

const initial: AcceptInviteState = { error: null };

export async function acceptInviteAction(
  _prev: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const token    = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm  = String(formData.get("confirm") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone    = String(formData.get("phone") ?? "").trim();

  if (!token)               return { error: "Missing invite token." };
  if (password.length < 8)  return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords don't match." };
  if (!fullName)            return { error: "Please confirm your full name." };
  // Phone is required so the trainer can call/SMS — matches the
  // owner-side requirement to capture phone for SMS reminders (#34).
  if (!phone)               return { error: "Please add a phone number so your trainer can reach you." };
  if (phone.length < 5)     return { error: "Phone number looks too short." };

  // Step 1 — revalidate token. If it expired between page render and
  // form submit, we want a clear error rather than a half-created user.
  const invite = await lookupInviteByToken(token).catch(() => null);
  if (!invite) {
    return {
      error: "This invitation is no longer valid. Ask your trainer for a new link.",
    };
  }

  // Step 2 — create the auth.user. Auto-confirmed because ownership of
  // the email was already proven by the inviter sending them the link.
  const admin = createSupabaseAdminClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email:         invite.email,
    password,
    email_confirm: true,
  });
  if (createErr || !created?.user) {
    // Most common cause: this email already has an auth user (the client
    // previously signed up, or it's also an owner account). We don't
    // auto-link to avoid surprise account merges. Show a clear, friendly
    // message instead of the raw Supabase error.
    const raw = createErr?.message?.toLowerCase() ?? "";
    if (raw.includes("already") && (raw.includes("registered") || raw.includes("exist"))) {
      return {
        error:
          "This email already has a Longrein account — there's no need to set up a new one. Just sign in with it instead.",
      };
    }
    return {
      error: "We couldn't set up your account just now. Please try again, or ask your trainer for a fresh invite link.",
    };
  }

  // Step 3 — atomic: mark invite used + create profile + link clients.profile_id.
  try {
    const profileId = await acceptInviteAndCreateProfile(
      token,
      created.user.id,
      fullName,
      phone,
    );
    if (!profileId) {
      // Invite was consumed/expired in a race after our re-check.
      await admin.auth.admin.deleteUser(created.user.id);
      return {
        error:
          "This invitation was just used or expired. Ask your trainer for a new link.",
      };
    }
  } catch (err: any) {
    // Roll back the auth user so the client can retry cleanly.
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
    return {
      error:
        err?.message?.includes("already belongs to a stable")
          ? "This email is already linked to another account. Sign in there instead."
          : `Could not finish setup: ${err?.message ?? "unknown error"}.`,
    };
  }

  // Step 4 — bounce to login with prefilled email so the just-set
  // password works on the first try.
  redirect(`/login?invited=1&email=${encodeURIComponent(invite.email)}`);
}
