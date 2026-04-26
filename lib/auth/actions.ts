"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null };

// ---- Login -------------------------------------------------------
export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Email and password required." };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect("/dashboard");
}

// ---- Owner signup (creates auth user + stable + owner profile) ---
export async function signupOwnerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email      = String(formData.get("email") ?? "").trim();
  const password   = String(formData.get("password") ?? "");
  const stableName = String(formData.get("stable_name") ?? "").trim();
  const stableSlug = String(formData.get("stable_slug") ?? "").trim().toLowerCase();
  const fullName   = String(formData.get("full_name") ?? "").trim();

  if (!email || !password || !stableName || !stableSlug || !fullName) {
    return { error: "All fields are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (!/^[a-z0-9-]{2,40}$/.test(stableSlug)) {
    return { error: "Slug must be 2-40 lowercase letters, digits, or hyphens." };
  }

  const supabase = createSupabaseServerClient();

  // 1. Create the auth user.
  const { data, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });
  if (signUpError) return { error: signUpError.message };

  // 2. Make sure we have a session before calling provision_stable
  //    (it requires auth.uid()). If email confirmation is enabled in
  //    Supabase, signUp will not return a session.
  if (!data.session) {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      return {
        error:
          "Account created. Confirm your email then sign in to finish setup.",
      };
    }
  }

  // 3. Provision the stable + owner profile in one RPC.
  const { error: provisionError } = await supabase.rpc("provision_stable", {
    p_stable_name: stableName,
    p_stable_slug: stableSlug,
    p_full_name:   fullName,
  });
  if (provisionError) return { error: provisionError.message };

  redirect("/dashboard");
}

// ---- Logout ------------------------------------------------------
export async function logoutAction() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
