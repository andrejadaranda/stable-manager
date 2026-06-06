// Ambassador program — server-side data access.
//
// Uses a service-role Supabase client (bypasses RLS) because applications
// and the ambassadors/referrals tables are admin-only by policy. NEVER
// import this from a client component — server components + server actions
// only. Owner-role gating is enforced at the page/action layer.

import "server-only";
import { createClient } from "@supabase/supabase-js";

// Untyped service-role client: these tables are not in the generated
// Database types yet, so an untyped client keeps `.from()` ergonomic.
function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export type Application = {
  id: string;
  created_at: string;
  status: string;
  full_name: string;
  email: string;
  country: string | null;
  horses: string | null;
  discipline: string | null;
  describes: string | null;
  audience: string | null;
  community_type: string | null;
  community_size: string | null;
  support: string | null;
  invite_count: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  youtube: string | null;
  other_links: string | null;
  notes_applicant: string | null;
  admin_notes: string | null;
};

export type Ambassador = {
  id: string;
  full_name: string;
  email: string;
  country: string | null;
  status: string;
  referral_code: string | null;
  tier: string;
  paid_referrals: number;
  total_commission_cents: number;
  created_at: string;
};

export async function listApplications(status?: string): Promise<Application[]> {
  let q = admin()
    .from("ambassador_applications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Application[];
}

export async function listAmbassadors(): Promise<Ambassador[]> {
  const { data, error } = await admin()
    .from("ambassadors")
    .select("id, full_name, email, country, status, referral_code, tier, paid_referrals, total_commission_cents, created_at")
    .order("paid_referrals", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as Ambassador[];
}

/** Approve an application → creates the ambassador (bronze, with code). */
export async function approveApplication(applicationId: string): Promise<void> {
  const { error } = await admin().rpc("approve_ambassador_application", {
    p_app_id: applicationId,
  });
  if (error) throw new Error(error.message);
}

export async function rejectApplication(applicationId: string): Promise<void> {
  const { error } = await admin()
    .from("ambassador_applications")
    .update({ status: "rejected" })
    .eq("id", applicationId);
  if (error) throw new Error(error.message);
}

export async function setAmbassadorNotes(applicationId: string, notes: string): Promise<void> {
  const { error } = await admin()
    .from("ambassador_applications")
    .update({ admin_notes: notes.slice(0, 4000) })
    .eq("id", applicationId);
  if (error) throw new Error(error.message);
}

export function eur(cents: number): string {
  return "€" + (Math.round(cents) / 100).toLocaleString("en-IE", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export const TIER_LABEL: Record<string, string> = {
  bronze: "🥉 Bronze",
  silver: "🥈 Silver",
  gold: "🥇 Gold",
  platinum: "💎 Platinum",
};
