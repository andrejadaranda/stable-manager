"use server";

import { revalidatePath } from "next/cache";
import {
  createGuestContributorToken,
  revokeGuestContributorToken,
  type GuestContributorKind,
} from "@/services/guestContributors";

export type CreateGuestTokenState = {
  error:    string | null;
  token:    string | null;
  shareUrl: string | null;
};

const initial: CreateGuestTokenState = { error: null, token: null, shareUrl: null };
export { initial as initialCreateGuestTokenState };

const ERROR_COPY: Record<string, string> = {
  INVALID_CONTRIBUTOR_NAME:    "Add the contributor's name.",
  CONTRIBUTOR_NAME_TOO_LONG:   "Name must be 80 characters or fewer.",
  INVALID_HORSE:               "Missing horse.",
  INVALID_KIND:                "Pick vet or farrier.",
  HORSE_NOT_FOUND:             "Couldn't find that horse.",
  FORBIDDEN:                   "You can only invite contributors for horses in your stable.",
  UNAUTHENTICATED:             "Your session expired. Sign in again.",
};

export async function createGuestTokenAction(
  _prev: CreateGuestTokenState,
  formData: FormData,
): Promise<CreateGuestTokenState> {
  const horseId         = String(formData.get("horse_id") ?? "");
  const kindRaw         = String(formData.get("kind") ?? "");
  const contributorName = String(formData.get("contributor_name") ?? "");

  if (kindRaw !== "vet" && kindRaw !== "farrier") {
    return { error: "Pick vet or farrier.", token: null, shareUrl: null };
  }

  try {
    const t = await createGuestContributorToken({
      horseId,
      kind:            kindRaw as GuestContributorKind,
      contributorName,
    });
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.longrein.eu";
    const shareUrl = `${origin}/guest/log/${t.token}`;

    revalidatePath(`/dashboard/horses/${horseId}`);
    return { error: null, token: t.token, shareUrl };
  } catch (err: any) {
    const code = err?.message ?? "";
    return { error: ERROR_COPY[code] ?? `Could not create link: ${code || "unknown error"}.`, token: null, shareUrl: null };
  }
}

export async function revokeGuestTokenAction(tokenId: string, horseId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await revokeGuestContributorToken(tokenId);
    revalidatePath(`/dashboard/horses/${horseId}`);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Could not revoke link." };
  }
}
