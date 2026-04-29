// Client agreements service — owner-curated checklist of signed
// documents per client. v1 is tracking-only; uploads + e-sign are
// later phases. RLS:
//   * staff (owner+employee) read all in stable
//   * client reads own
//   * OWNER-only writes

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getSession,
  requireRole,
  requireOwnerOrClientSelf,
} from "@/lib/auth/session";

export type AgreementKind =
  | "waiver"
  | "gdpr_consent"
  | "stable_rules"
  | "boarding_contract"
  | "other";

export type AgreementRow = {
  id: string;
  stable_id: string;
  client_id: string;
  kind: AgreementKind;
  custom_label: string | null;
  signed_at: string; // YYYY-MM-DD
  required_for_boarders: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateAgreementInput = {
  clientId: string;
  kind: AgreementKind;
  customLabel?: string | null;
  signedAt?: string; // defaults to today
  requiredForBoarders?: boolean;
  notes?: string | null;
};

// ---------- writes (owner only) -----------------------------------

export async function createAgreement(
  input: CreateAgreementInput,
): Promise<AgreementRow> {
  const session = await getSession();
  requireRole(session, "owner");

  if (input.kind === "other" && !input.customLabel?.trim()) {
    throw new Error("AGREEMENT_LABEL_REQUIRED");
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("client_agreements")
    .insert({
      stable_id:             session.stableId,
      client_id:             input.clientId,
      kind:                  input.kind,
      custom_label:          input.customLabel ?? null,
      signed_at:             input.signedAt ?? new Date().toISOString().slice(0, 10),
      required_for_boarders: input.requiredForBoarders ?? false,
      notes:                 input.notes ?? null,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("AGREEMENT_DUPLICATE");
    throw error;
  }
  return data as AgreementRow;
}

export async function deleteAgreement(agreementId: string): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("client_agreements")
    .delete()
    .eq("id", agreementId);
  if (error) throw error;
}

// ---------- reads -------------------------------------------------

export async function listClientAgreements(
  clientId: string,
): Promise<AgreementRow[]> {
  const session = await getSession();
  requireOwnerOrClientSelf(session, clientId);
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("client_agreements")
    .select("*")
    .eq("client_id", clientId)
    .order("signed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AgreementRow[];
}
