// Guest contributor token service — staff side.
// External vets / farriers post to a horse's health log via the
// /guest/log/[token] route which calls the SECURITY DEFINER RPC.
// This service handles the OWNER side: mint, list, revoke.

import { randomBytes } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";

export type { GuestContributorKind, GuestContributorToken } from "./guestContributors.pure";
export { KIND_LABEL } from "./guestContributors.pure";
import type { GuestContributorKind, GuestContributorToken } from "./guestContributors.pure";

/** Mint a high-entropy URL-safe token. 32 bytes = 256 bits, base64url
 *  encoded gives ~43 chars — uniqueness is astronomical, no collision
 *  retry needed for the lifetime of the universe. */
function mintToken(): string {
  return randomBytes(32).toString("base64url");
}

export type CreateGuestTokenInput = {
  horseId:         string;
  kind:            GuestContributorKind;
  contributorName: string;
  /** Optional override — default = 90 days from now. */
  expiresInDays?:  number;
};

export async function createGuestContributorToken(
  input: CreateGuestTokenInput,
): Promise<GuestContributorToken> {
  const ctx = await getSession();
  requireRole(ctx, "owner", "employee");

  const name = input.contributorName.trim();
  if (!name) throw new Error("INVALID_CONTRIBUTOR_NAME");
  if (name.length > 80) throw new Error("CONTRIBUTOR_NAME_TOO_LONG");
  if (!input.horseId) throw new Error("INVALID_HORSE");
  if (input.kind !== "vet" && input.kind !== "farrier") throw new Error("INVALID_KIND");

  const supabase = createSupabaseServerClient();

  // Defense-in-depth: confirm horse belongs to caller's stable BEFORE we
  // store anything. RLS would catch it, but a clear error message wins.
  const { data: horse, error: hErr } = await supabase
    .from("horses")
    .select("stable_id")
    .eq("id", input.horseId)
    .maybeSingle();
  if (hErr || !horse) throw new Error("HORSE_NOT_FOUND");
  if (horse.stable_id !== ctx.stableId) throw new Error("FORBIDDEN");

  const expiresInDays = input.expiresInDays ?? 90;
  const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000).toISOString();

  const { data, error } = await supabase
    .from("guest_contributor_tokens")
    .insert({
      stable_id:        ctx.stableId,
      horse_id:         input.horseId,
      token:            mintToken(),
      kind:             input.kind,
      contributor_name: name,
      created_by:       ctx.userId,
      expires_at:       expiresAt,
    })
    .select("id, horse_id, token, kind, contributor_name, expires_at, revoked_at, last_used_at, use_count, created_at")
    .single();
  if (error) throw error;
  return data as GuestContributorToken;
}

export async function listGuestContributorTokens(
  horseId: string,
): Promise<GuestContributorToken[]> {
  await getSession();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("guest_contributor_tokens")
    .select("id, horse_id, token, kind, contributor_name, expires_at, revoked_at, last_used_at, use_count, created_at")
    .eq("horse_id", horseId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as GuestContributorToken[];
}

export async function revokeGuestContributorToken(tokenId: string): Promise<void> {
  const ctx = await getSession();
  requireRole(ctx, "owner", "employee");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("guest_contributor_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", tokenId);
  if (error) throw error;
}
