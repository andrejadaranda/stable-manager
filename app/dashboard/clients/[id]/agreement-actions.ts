"use server";

import { revalidatePath } from "next/cache";
import {
  createAgreement,
  deleteAgreement,
  type AgreementKind,
} from "@/services/agreements";
import { toFriendlyError } from "@/lib/errors/friendly";

export type AgreementActionState = {
  error: string | null;
  success: boolean;
};

const initial: AgreementActionState = { error: null, success: false };

const KINDS: AgreementKind[] = [
  "waiver",
  "gdpr_consent",
  "stable_rules",
  "boarding_contract",
  "other",
];

export async function createAgreementAction(
  _prev: AgreementActionState,
  formData: FormData,
): Promise<AgreementActionState> {
  const clientId    = String(formData.get("client_id") ?? "");
  const kindRaw     = String(formData.get("kind") ?? "");
  const customLabel = String(formData.get("custom_label") ?? "").trim();
  const signedAt    = String(formData.get("signed_at") ?? "").trim();
  const reqRaw      = String(formData.get("required_for_boarders") ?? "false");
  const notes       = String(formData.get("notes") ?? "").trim();

  if (!clientId)                       return { ...initial, error: "Missing client id." };
  if (!KINDS.includes(kindRaw as AgreementKind)) {
    return { ...initial, error: "Pick a document type." };
  }

  try {
    await createAgreement({
      clientId,
      kind:                kindRaw as AgreementKind,
      customLabel:         customLabel || null,
      signedAt:            signedAt || undefined,
      requiredForBoarders: reqRaw === "true",
      notes:               notes || null,
    });
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  revalidatePath(`/dashboard/clients/${clientId}`);
  return { error: null, success: true };
}

export async function deleteAgreementAction(
  _prev: AgreementActionState,
  formData: FormData,
): Promise<AgreementActionState> {
  const id        = String(formData.get("agreement_id") ?? "");
  const clientId  = String(formData.get("client_id") ?? "");
  if (!id) return { ...initial, error: "Missing id." };

  try {
    await deleteAgreement(id);
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  if (clientId) revalidatePath(`/dashboard/clients/${clientId}`);
  return { error: null, success: true };
}
