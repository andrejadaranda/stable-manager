"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isDisposableEmail,
  extractClientIp,
  checkSignupRateLimit,
  recordSignupAttempt,
} from "@/lib/auth/anti-abuse";

export type ActionState = {
  error: string | null;
  /**
   * Set to "unconfirmed" when the failure was specifically that the user has
   * not yet confirmed their email. The login form uses this to show a
   * "Resend confirmation" button instead of just a generic error.
   */
  code?: "unconfirmed" | null;
  /** Echoed back so the resend button can pre-fill the email. */
  email?: string | null;
};

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

/**
 * Build the absolute base URL the user is currently visiting from. Falls back
 * to NEXT_PUBLIC_SITE_URL, then localhost. Used to construct emailRedirectTo
 * so confirmation links work in dev, preview, and production without manual
 * config changes per environment.
 */
function siteOrigin(): string {
  const h = headers();
  const forwardedHost = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) return `${proto}://${forwardedHost}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Map raw Supabase auth errors to friendly copy. */
function mapAuthError(message: string): {
  error: string;
  code?: "unconfirmed";
} {
  const m = message.toLowerCase();
  if (m.includes("email not confirmed")) {
    return {
      error:
        "Please confirm your email first. Check your inbox (and spam) for the link, or resend it below.",
      code: "unconfirmed",
    };
  }
  if (m.includes("invalid login")) {
    return { error: "Wrong email or password." };
  }
  if (m.includes("user already registered")) {
    return {
      error:
        "An account with this email already exists. Try signing in instead.",
    };
  }
  if (m.includes("rate limit") || m.includes("for security purposes")) {
    return {
      error:
        "Too many attempts. Please wait a minute and try again — or check spam, the email may already be on its way.",
    };
  }
  return { error: message };
}

// ---------------------------------------------------------------
// Login
// ---------------------------------------------------------------
export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password)
    return { error: "Email and password required.", email };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const mapped = mapAuthError(error.message);
    return { error: mapped.error, code: mapped.code ?? null, email };
  }

  redirect("/dashboard");
}

// ---------------------------------------------------------------
// Owner signup
// ---------------------------------------------------------------
// Creates the auth user. Stable name / slug / full name are stashed in
// user_metadata so the /auth/callback route can call provision_stable AFTER
// the user clicks the confirmation link (i.e. once auth.uid() is available).
//
// The form is redirected to /auth/check-email even on success — we never
// silently sign the user in, because that path was the source of the bug
// where the form quietly failed when "Confirm email" was on in Supabase.
// ---------------------------------------------------------------
export async function signupOwnerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const stableName = String(formData.get("stable_name") ?? "").trim();
  const stableSlug = String(formData.get("stable_slug") ?? "")
    .trim()
    .toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!email || !password || !stableName || !stableSlug || !fullName) {
    return { error: "All fields are required.", email };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", email };
  }
  if (!/^[a-z0-9-]{2,40}$/.test(stableSlug)) {
    return {
      error: "Slug must be 2-40 lowercase letters, digits, or hyphens.",
      email,
    };
  }

  // Anti-abuse layer 1: disposable inbox blocklist. Most trial-farming
  // attempts use known throwaway providers; rejecting them here saves
  // a Supabase Auth round-trip + the email confirmation cycle.
  if (isDisposableEmail(email)) {
    return {
      error: "Please use a real, permanent email address. Disposable inboxes are not supported.",
      email,
    };
  }

  // Anti-abuse layer 2: IP rate limit. Prevents the same network from
  // spinning up many new stables to farm 14-day trials.
  const clientIp = extractClientIp(headers());
  const rateCheck = await checkSignupRateLimit(clientIp);
  if (!rateCheck.allowed) {
    return {
      error: "Too many signups from your network. Please try again later or email hello@longrein.eu if this is a mistake.",
      email,
    };
  }

  const supabase = createSupabaseServerClient();

  const { data, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Confirmation email link will hit our server route, which exchanges
      // the code for a session and finishes provisioning.
      emailRedirectTo: `${siteOrigin()}/auth/callback`,
      // Stash the stable info on the auth user so /auth/callback can finish
      // provision_stable after confirmation.
      data: {
        full_name: fullName,
        stable_name: stableName,
        stable_slug: stableSlug,
      },
    },
  });

  if (signUpError) {
    const mapped = mapAuthError(signUpError.message);
    return { error: mapped.error, code: mapped.code ?? null, email };
  }

  // Fire-and-forget — count this IP attempt for future rate-limit checks.
  void recordSignupAttempt(clientIp);

  // Two cases here:
  //   A) Email confirmation IS enabled in Supabase  -> data.session is null.
  //      We must NOT try to sign the user in; we redirect them to a "check
  //      your email" page that explains what to do and offers a resend.
  //   B) Email confirmation is OFF                  -> data.session exists.
  //      We can finish provisioning now and drop them into the dashboard.

  if (!data.session) {
    redirect(`/auth/check-email?email=${encodeURIComponent(email)}`);
  }

  // Case B — confirmation disabled. Provision immediately.
  const { error: provisionError } = await supabase.rpc("provision_stable", {
    p_stable_name: stableName,
    p_stable_slug: stableSlug,
    p_full_name: fullName,
  });
  if (provisionError) {
    return { error: provisionError.message, email };
  }

  redirect("/dashboard");
}

// ---------------------------------------------------------------
// Personal (B2C) signup — €9/€15 single-user account
// ---------------------------------------------------------------
// No stable, no clients, no staff — the user manages their own horses
// only. /auth/callback sees `account_type=personal` in user_metadata and
// calls provision_personal_account RPC instead of provision_stable.
// ---------------------------------------------------------------
export async function signupPersonalAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email     = String(formData.get("email") ?? "").trim();
  const password  = String(formData.get("password") ?? "");
  const fullName  = String(formData.get("full_name") ?? "").trim();
  const planTier  = String(formData.get("plan_tier") ?? "mini");

  if (!email || !password || !fullName) {
    return { error: "All fields are required.", email };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", email };
  }
  if (planTier !== "mini" && planTier !== "plus") {
    return { error: "Pick a plan (Mini or Plus).", email };
  }

  // Anti-abuse — same guards as owner signup. See lib/auth/anti-abuse.ts.
  if (isDisposableEmail(email)) {
    return {
      error: "Please use a real, permanent email address. Disposable inboxes are not supported.",
      email,
    };
  }
  const clientIp = extractClientIp(headers());
  const rateCheck = await checkSignupRateLimit(clientIp);
  if (!rateCheck.allowed) {
    return {
      error: "Too many signups from your network. Please try again later or email hello@longrein.eu if this is a mistake.",
      email,
    };
  }

  const supabase = createSupabaseServerClient();
  const { data, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteOrigin()}/auth/callback`,
      data: {
        account_type:        "personal",
        full_name:           fullName,
        personal_plan_tier:  planTier,
      },
    },
  });

  if (signUpError) {
    const mapped = mapAuthError(signUpError.message);
    return { error: mapped.error, code: mapped.code ?? null, email };
  }

  void recordSignupAttempt(clientIp);

  if (!data.session) {
    redirect(`/auth/check-email?email=${encodeURIComponent(email)}`);
  }

  // Email-confirmation OFF — provision immediately.
  const { error: provisionError } = await supabase.rpc("provision_personal_account", {
    p_full_name: fullName,
    p_plan_tier: planTier,
  });
  if (provisionError) {
    return { error: provisionError.message, email };
  }

  redirect("/dashboard");
}

// ---------------------------------------------------------------
// Resend confirmation
// ---------------------------------------------------------------
// Re-trigger the Supabase confirmation email. Used from /auth/check-email
// and from the login form when we detect "Email not confirmed".
// ---------------------------------------------------------------
export type ResendState = {
  error: string | null;
  ok: boolean;
};

export async function resendConfirmationAction(
  _prev: ResendState,
  formData: FormData,
): Promise<ResendState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Email is required.", ok: false };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${siteOrigin()}/auth/callback`,
    },
  });
  if (error) {
    return { error: mapAuthError(error.message).error, ok: false };
  }
  return { error: null, ok: true };
}

// ---------------------------------------------------------------
// Forgot password — request a reset email
// ---------------------------------------------------------------
// Triggers Supabase's password-recovery email via Resend SMTP. The link
// in the email lands the user at /reset-password with a short-lived
// recovery session, which the reset-password page completes with a new
// password.
//
// Security: we ALWAYS return the same "sent" response — we never reveal
// whether the email exists in our system. This is the standard pattern
// for password reset flows; a leaky reset endpoint is a free user
// enumeration oracle.
// ---------------------------------------------------------------
export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Email is required.", email };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteOrigin()}/reset-password`,
  });

  // Quietly log non-rate-limit errors but never expose them to the
  // caller — see comment above for why.
  if (error && !error.message.toLowerCase().includes("rate")) {
    console.warn("[forgot-password]", error.message);
  }
  if (error && error.message.toLowerCase().includes("rate")) {
    return { error: mapAuthError(error.message).error, email };
  }

  redirect(`/forgot-password?sent=${encodeURIComponent(email)}`);
}

// ---------------------------------------------------------------
// Update password — complete a recovery
// ---------------------------------------------------------------
// Called from /reset-password after the user lands from a recovery link.
// The Supabase session at this point is in "recovery" mode and the only
// thing it's authorised for is updating the password.
// ---------------------------------------------------------------
export async function updatePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  const confirm  = String(formData.get("confirm_password") ?? "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords don't match." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: mapAuthError(error.message).error };
  }

  redirect("/dashboard");
}

// ---------------------------------------------------------------
// Logout
// ---------------------------------------------------------------
export async function logoutAction() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
