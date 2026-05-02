// 2FA / MFA service. Wraps Supabase's built-in TOTP factor API.
//
// Flow:
//   1. listFactors()           — check current state
//   2. enrollTotp()            — creates a pending factor, returns
//                                QR code (data-URL or otpauth URI)
//                                + secret. User scans into Authy /
//                                Google Authenticator / 1Password.
//   3. verifyEnrollment(code)  — confirms by submitting a 6-digit
//                                code; flips factor status to verified.
//   4. unenrollTotp(factorId)  — remove a factor; only allowed when
//                                another factor exists or AAL=1 acceptable.
//
// Supabase requires the user be signed in for all of these. The
// service uses the SSR client which carries the cookie session.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

export type MfaFactor = {
  id:          string;
  status:      "verified" | "unverified";
  factor_type: "totp" | "phone";
  friendly_name: string | null;
  created_at:  string;
};

export type EnrollResult = {
  factorId:   string;
  qrCodeSvg:  string;
  secret:     string;
  uri:        string;
};

export async function listMfaFactors(): Promise<MfaFactor[]> {
  await getSession();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  const all = [...(data.totp ?? [])];
  return all.map((f) => ({
    id:            f.id,
    status:        f.status as "verified" | "unverified",
    factor_type:   f.factor_type as "totp",
    friendly_name: f.friendly_name ?? null,
    created_at:    f.created_at,
  }));
}

export async function enrollTotp(friendlyName?: string): Promise<EnrollResult> {
  await getSession();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType:   "totp",
    friendlyName: friendlyName ?? `Authenticator · ${new Date().toLocaleDateString()}`,
  });
  if (error) throw error;
  return {
    factorId:   data.id,
    qrCodeSvg:  data.totp.qr_code,
    secret:     data.totp.secret,
    uri:        data.totp.uri,
  };
}

export async function verifyEnrollment(factorId: string, code: string): Promise<void> {
  await getSession();
  const supabase = createSupabaseServerClient();
  // 1. challenge
  const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
  if (chErr) throw chErr;
  // 2. verify
  const { error: vErr } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: ch.id,
    code,
  });
  if (vErr) throw vErr;
}

export async function unenrollFactor(factorId: string): Promise<void> {
  await getSession();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}
