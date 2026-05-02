"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { updateOwnStable } from "@/services/stables";
import { updateOwnProfile } from "@/services/account";
import { toFriendlyError } from "@/lib/errors/friendly";

/**
 * Settings server actions.
 *
 * Pattern:
 *   1. Try the service call.
 *   2. On failure, redirect back with ?err=<friendly LT message>.
 *   3. On success, redirect with ?ok=<short LT confirmation>.
 *
 * The FlashToast component on the client reads ?ok / ?err from the URL.
 */

function bounce(path: string, params: { ok?: string; err?: string }): never {
  const qs = new URLSearchParams();
  if (params.ok)  qs.set("ok",  params.ok);
  if (params.err) qs.set("err", params.err);
  redirect(qs.toString() ? `${path}?${qs}` : path);
}

export async function updateStableNameAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "");
  try {
    await updateOwnStable({ name });
  } catch (err) {
    bounce("/dashboard/settings/stable", { err: toFriendlyError(err).message });
  }
  revalidatePath("/dashboard/settings/stable");
  bounce("/dashboard/settings/stable", { ok: "Stable info updated." });
}

export async function updateProfileNameAction(formData: FormData): Promise<void> {
  const fullName = String(formData.get("full_name") ?? "");
  const photoUrl = String(formData.get("photo_url") ?? "");
  const phone    = String(formData.get("phone")     ?? "");
  try {
    await updateOwnProfile({ fullName, photoUrl, phone });
  } catch (err) {
    bounce("/dashboard/settings/profile", { err: toFriendlyError(err).message });
  }
  revalidatePath("/dashboard/settings/profile");
  revalidatePath("/dashboard", "layout");
  bounce("/dashboard/settings/profile", { ok: "Profile updated." });
}
