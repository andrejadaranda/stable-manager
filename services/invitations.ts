// Client portal invitations service.
//
// Server-side helpers around the `client_invitations` table + the two
// SECURITY DEFINER RPCs (lookup_client_invitation, consume_client_invitation).
//
// Why this lives in its own service file rather than under clients.ts:
//   * The accept flow is callable by anonymous users (the recipient is
//     not yet a Supabase auth.user) — separating it makes the trust
//     boundary obvious and keeps clients.ts owner/staff-scoped.
//   * The token generation + email send only matter at invite-time, so
//     keeping it adjacent to the lookup/consume helpers reads as one
//     coherent module.

import { randomBytes } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";
import { getClient } from "@/services/clients";
import { getOwnStable } from "@/services/stables";
import { sendClientInviteEmail } from "@/lib/email/client-invite";

/** Row shape returned by listInvitationsForClient. */
export type InvitationRow = {
  id:         string;
  email:      string;
  expires_at: string;
  used_at:    string | null;
  revoked_at: string | null;
  created_at: string;
  /** Convenience: render this URL in the UI for the owner to copy. */
  invite_url: string;
};

/** Result of lookupInviteByToken — used by the public accept page. */
export type InvitationLookup = {
  id:          string;
  stable_id:   string;
  stable_name: string;
  client_id:   string;
  client_name: string;
  email:       string;
  expires_at:  string;
};

/** Result of findExistingLongreinAccounts — sets of contact strings
 *  that are already attached to a Longrein auth.user / profile. */
export type ExistingAccountMatches = {
  matchedEmails: Set<string>;
  matchedPhones: Set<string>;
};

/**
 * Generate a fresh URL-safe random token. 32 bytes ≈ 43 base64url chars.
 * Crypto-grade entropy — anyone who guesses this gets in, so we don't
 * cheap out on RNG.
 */
function generateInviteToken(): string {
  return randomBytes(32)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Base URL for invite links. Read from env; fallback prevents broken
 *  links if NEXT_PUBLIC_SITE_URL isn't set in prod. */
function getInviteBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.longrein.eu";
  return raw.replace(/\/+$/, "");
}

function buildInviteUrl(token: string): string {
  return `${getInviteBaseUrl()}/invite/${token}`;
}

// =================================================================
// CREATE — owner clicks "Invite to app" on a client row.
// Creates a new invitation row + sends the email. Idempotent at the
// email-send level (idempotency key derived from token). If the same
// client already has a non-revoked, non-expired, non-used invite, we
// reissue (revoke the old one) rather than email twice with two
// different links — only one link is valid at a time per client.
// =================================================================
export type SendInviteResult = {
  invitation: InvitationRow;
  /** True when the email actually went out, false when Resend was
   *  unavailable and we kept the row anyway so the owner can copy
   *  the link manually. */
  emailSent: boolean;
};

export async function sendClientInvite(input: {
  clientId: string;
  /** Override the client.email. Optional — defaults to clients.email. */
  email?: string;
}): Promise<SendInviteResult> {
  const session = await getSession();
  requireRole(session, "owner");

  const client = await getClient(input.clientId);
  if (!client) throw new Error("CLIENT_NOT_FOUND");
  if (client.profile_id) {
    throw new Error("CLIENT_ALREADY_LINKED");
  }

  const email = (input.email?.trim() || client.email?.trim() || "").toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("INVITE_EMAIL_MISSING");
  }

  const supabase = createSupabaseServerClient();

  // Revoke any existing pending invite for the same client. Keeps
  // "one live link per client" invariant — older links won't work
  // after a reissue, which is the safer default (prevents confusion
  // when an owner reissues because the first one got lost).
  await supabase
    .from("client_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("client_id", input.clientId)
    .is("used_at", null)
    .is("revoked_at", null);

  const token = generateInviteToken();
  const { data: invRow, error: insertErr } = await supabase
    .from("client_invitations")
    .insert({
      stable_id:  session.stableId,
      client_id:  input.clientId,
      email,
      token,
      created_by: session.userId,
    })
    .select("id, email, expires_at, used_at, revoked_at, created_at")
    .single();
  if (insertErr || !invRow) {
    throw new Error(insertErr?.message ?? "INVITE_INSERT_FAILED");
  }

  const inviteUrl = buildInviteUrl(token);

  let emailSent = false;
  try {
    // Fetch stable name + inviter name in parallel — both are needed
    // for personalised body copy.
    const [stable, inviter] = await Promise.all([
      getOwnStable(),
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.userId)
        .maybeSingle()
        .then((r) => (r.data as { full_name: string | null } | null)?.full_name ?? null),
    ]);
    await sendClientInviteEmail({
      to:          email,
      clientName:  client.full_name,
      stableName:  stable.name,
      inviterName: inviter ?? "Your trainer",
      inviteUrl,
    });
    emailSent = true;
  } catch (err) {
    // Don't roll back the invitation row — the link still works, and
    // the owner can copy it from the UI. Log and continue.
    console.warn("[invite] email send failed; link kept:", err);
  }

  const row = invRow as Omit<InvitationRow, "invite_url">;
  return {
    invitation: { ...row, invite_url: inviteUrl },
    emailSent,
  };
}

// =================================================================
// LIST — owner-facing, all invites for a single client.
// Used by the client detail page to show invite status + a Resend /
// Revoke action per row.
// =================================================================
export async function listInvitationsForClient(
  clientId: string,
): Promise<InvitationRow[]> {
  const session = await getSession();
  requireRole(session, "owner");
  void session;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("client_invitations")
    .select("id, email, expires_at, used_at, revoked_at, created_at, token")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const row = r as Omit<InvitationRow, "invite_url"> & { token: string };
    const { token, ...rest } = row;
    return { ...rest, invite_url: buildInviteUrl(token) };
  });
}

/** Returns the pending invite for a client (or null) — used by the
 *  client list "invite status pill" so we don't pull the whole history. */
export async function getPendingInviteForClient(
  clientId: string,
): Promise<InvitationRow | null> {
  const session = await getSession();
  requireRole(session, "owner");
  void session;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("client_invitations")
    .select("id, email, expires_at, used_at, revoked_at, created_at, token")
    .eq("client_id", clientId)
    .is("used_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as Omit<InvitationRow, "invite_url"> & { token: string };
  const { token, ...rest } = row;
  return { ...rest, invite_url: buildInviteUrl(token) };
}

// =================================================================
// REVOKE — owner cancels a pending invite.
// =================================================================
export async function revokeInvitation(invitationId: string): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner");
  void session;

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("client_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", invitationId)
    .is("used_at", null);
  if (error) throw error;
}

// =================================================================
// CROSS-STABLE ACCOUNT PROBE
//
// Bulk check: which of these emails/phones already belong to a
// Longrein auth.user (any stable)? Used by the client list to hide
// the "Invite to app" button for clients who already have an account
// — otherwise the invite would 500 ("email already registered") or
// surprise the owner with a cross-stable link suggestion.
//
// Returns sets so the caller can do O(1) membership checks per row.
// Owner-only; the RPC re-asserts the role server-side.
// =================================================================
export async function findExistingLongreinAccounts(input: {
  emails: string[];
  phones: string[];
}): Promise<ExistingAccountMatches> {
  const emails = Array.from(
    new Set(
      input.emails
        .filter(Boolean)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@")),
    ),
  );
  const phones = Array.from(
    new Set(input.phones.filter(Boolean).map((p) => p.trim())),
  );

  if (emails.length === 0 && phones.length === 0) {
    return { matchedEmails: new Set(), matchedPhones: new Set() };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc(
    "check_existing_longrein_accounts",
    { p_emails: emails, p_phones: phones },
  );
  if (error) throw error;

  const matchedEmails = new Set<string>();
  const matchedPhones = new Set<string>();
  for (const row of (data ?? []) as Array<{
    matched_email: string | null;
    matched_phone: string | null;
  }>) {
    if (row.matched_email) matchedEmails.add(row.matched_email.toLowerCase());
    if (row.matched_phone) matchedPhones.add(row.matched_phone);
  }
  return { matchedEmails, matchedPhones };
}

// =================================================================
// LOOKUP — anonymous-callable, used by /invite/[token] accept page.
// Backed by the SECURITY DEFINER RPC — does NOT go through RLS.
// =================================================================
export async function lookupInviteByToken(
  token: string,
): Promise<InvitationLookup | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("lookup_client_invitation", {
    p_token: token,
  });
  if (error) throw error;
  const rows = (data ?? []) as InvitationLookup[];
  return rows[0] ?? null;
}

// =================================================================
// ACCEPT — anonymous-callable; called after the auth.user has been
// created with the chosen password. Atomically:
//   * marks invite used
//   * creates the profiles row (role=client) in the inviter's stable
//   * links clients.profile_id
//
// Returns the new profile id on success, or null when the invite was
// already used / expired / revoked between page-render and submit.
// Throws when the auth user already belongs to a stable (intentional
// safety — we do not silently merge accounts cross-stable).
// =================================================================
export async function acceptInviteAndCreateProfile(
  token: string,
  authUserId: string,
  fullName: string,
  /** Optional phone — written to profiles.phone always and to
   *  clients.phone when the owner left that field blank. NULL is fine. */
  phone?: string | null,
): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("accept_client_invitation", {
    p_token:        token,
    p_auth_user_id: authUserId,
    p_full_name:    fullName,
    p_phone:        phone && phone.trim() ? phone.trim() : null,
  });
  if (error) throw error;
  return data ? String(data) : null;
}
