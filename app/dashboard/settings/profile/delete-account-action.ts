"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteMyAccount } from "@/services/account";
import { toFriendlyError } from "@/lib/errors/friendly";

export type DeleteAccountState = { error: string | null };

/** Permanently delete the signed-in account (App Store 5.1.1(v)). Requires
 *  the user to type DELETE to confirm. On success, signs out and leaves. */
export async function deleteAccountAction(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const confirm = String(formData.get("confirm") ?? "").trim();
  if (confirm !== "DELETE") {
    return { error: 'Type DELETE (in capitals) to confirm.' };
  }

  try {
    await deleteMyAccount();
  } catch (err) {
    return { error: toFriendlyError(err).message };
  }

  // The auth user is gone; clear the stale session cookie (best-effort),
  // then send them to the signed-out landing. redirect() must live outside
  // the try/catch above (it throws a control-flow signal).
  try {
    const supabase = createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    /* session already invalid — ignore */
  }
  redirect("/login?deleted=1");
}
