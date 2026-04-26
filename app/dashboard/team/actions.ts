"use server";

import { revalidatePath } from "next/cache";
import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

export type InviteState = {
  error: string | null;
  success: string | null;
};

const inviteInitialState: InviteState = { error: null, success: null };

// ----------------------------------------------------------------
// Invite an employee.
// 1. createUser via admin (auto-confirmed, with chosen password)
// 2. attach_user_to_stable RPC under the owner's session
// 3. on RPC failure, roll back by deleting the auth user
// ----------------------------------------------------------------
export async function inviteEmployeeAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const session = await getSession().catch(() => null);
  if (!session) return { error: "Not signed in.", success: null };
  if (session.role !== "owner")
    return { error: "Only owners can invite team members.", success: null };

  const email    = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!email || !fullName || !password)
    return { error: "Email, name, and password are required.", success: null };
  if (!email.includes("@"))
    return { error: "Email looks invalid.", success: null };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters.", success: null };

  const admin = createSupabaseAdminClient();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created?.user) {
    return { error: createErr?.message ?? "Could not create user.", success: null };
  }

  const supabase = createSupabaseServerClient();
  const { error: attachErr } = await supabase.rpc("attach_user_to_stable", {
    p_auth_user_id: created.user.id,
    p_full_name:    fullName,
    p_role:         "employee",
  });
  if (attachErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: attachErr.message, success: null };
  }

  revalidatePath("/dashboard/team");
  return {
    error: null,
    success: `${fullName} invited as employee. Share their login: ${email} / ${password}`,
  };
}

// ----------------------------------------------------------------
// Invite a client (grants portal access to an existing client record).
// 1. createUser via admin
// 2. attach_user_to_stable as 'client' (returns new profile.id)
// 3. update clients.profile_id to link the existing client record
// ----------------------------------------------------------------
export async function inviteClientAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const session = await getSession().catch(() => null);
  if (!session) return { error: "Not signed in.", success: null };
  if (session.role !== "owner")
    return { error: "Only owners can invite team members.", success: null };

  const email    = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const clientId = String(formData.get("client_id") ?? "").trim();

  if (!email || !fullName || !password || !clientId)
    return { error: "Email, name, password, and client are required.", success: null };
  if (!email.includes("@"))
    return { error: "Email looks invalid.", success: null };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters.", success: null };

  const admin = createSupabaseAdminClient();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created?.user) {
    return { error: createErr?.message ?? "Could not create user.", success: null };
  }

  const supabase = createSupabaseServerClient();
  const { data: profileId, error: attachErr } = await supabase.rpc(
    "attach_user_to_stable",
    {
      p_auth_user_id: created.user.id,
      p_full_name:    fullName,
      p_role:         "client",
    },
  );
  if (attachErr || !profileId) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: attachErr?.message ?? "Attach failed.", success: null };
  }

  // Link the existing client record. Guard with `is null` so we never
  // overwrite an existing portal link.
  const { error: linkErr, data: linked } = await supabase
    .from("clients")
    .update({ profile_id: profileId })
    .eq("id", clientId)
    .is("profile_id", null)
    .select("id")
    .single();
  if (linkErr || !linked) {
    return {
      error:
        "Account created but client link failed. Open Supabase and link clients.profile_id manually.",
      success: null,
    };
  }

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/clients");
  return {
    error: null,
    success: `${fullName} given portal access. Share their login: ${email} / ${password}`,
  };
}
