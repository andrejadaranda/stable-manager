// Lesson packages service.
//
// The data model: a `lesson_packages` row is a prepaid bundle (e.g.
// 8 lessons / month). Each lesson can opt-in to be "covered" by a
// package by setting lessons.package_id. The view
// `lesson_package_summary` pre-computes used / remaining / paid_amount.
//
// RLS:
//   * read   : staff + own client
//   * write  : OWNER only
// (Mirrors the payments table — packages are a financial transaction.)
//
// The service layer also offers `addPackagePayment` which writes a
// row into `payments` linked via package_id, so the upfront payment
// shows up in revenue/balance reports without special handling.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getSession,
  requireRole,
  requireOwnerOrClientSelf,
} from "@/lib/auth/session";

// ---------- types -------------------------------------------------

export type CreatePackageInput = {
  clientId: string;
  totalLessons: number;
  price: number;
  /** ISO timestamp; defaults to now() in the DB. */
  purchasedAt?: string;
  /** ISO timestamp; null = never expires. */
  expiresAt?: string | null;
  notes?: string | null;
  /** When true (default), also creates a `payments` row at `price`
   *  linked via package_id, so the package is logged as paid up front. */
  recordPayment?: boolean;
  /** Optional payment method override; defaults to cash. */
  paymentMethod?: "cash" | "card" | "transfer" | "other";
};

export type PackageSummaryRow = {
  id: string;
  stable_id: string;
  client_id: string;
  total_lessons: number;
  price: number;
  purchased_at: string;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  lessons_used: number;
  lessons_remaining: number;
  paid_amount: number;
  is_expired: boolean;
};

// ---------- writes ------------------------------------------------

/** Create a new package. Owner-only. Optionally logs the upfront
 *  payment in the same transaction (best-effort — if the payment
 *  fails, the package is still created and surfaces unpaid).
 */
export async function createPackage(input: CreatePackageInput) {
  const session = await getSession();
  requireRole(session, "owner");

  if (input.totalLessons <= 0) throw new Error("INVALID_PACKAGE_SIZE");
  if (input.price < 0)         throw new Error("INVALID_AMOUNT");
  if (input.expiresAt) {
    const purchased = input.purchasedAt
      ? new Date(input.purchasedAt).getTime()
      : Date.now();
    if (new Date(input.expiresAt).getTime() <= purchased) {
      throw new Error("INVALID_EXPIRY");
    }
  }

  const supabase = createSupabaseServerClient();
  const { data: pkg, error } = await supabase
    .from("lesson_packages")
    .insert({
      stable_id:     session.stableId,
      client_id:     input.clientId,
      total_lessons: input.totalLessons,
      price:         input.price,
      purchased_at:  input.purchasedAt ?? new Date().toISOString(),
      expires_at:    input.expiresAt ?? null,
      notes:         input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  // Best-effort upfront payment. Skip if recordPayment === false or
  // price is 0 (a "comp'd" package the owner gives for free).
  const shouldRecord = input.recordPayment !== false && input.price > 0;
  if (shouldRecord) {
    const { error: payErr } = await supabase
      .from("payments")
      .insert({
        stable_id:  session.stableId,
        client_id:  input.clientId,
        package_id: (pkg as { id: string }).id,
        lesson_id:  null,
        amount:     input.price,
        method:     input.paymentMethod ?? "cash",
        paid_at:    input.purchasedAt ?? new Date().toISOString(),
        notes:      "Package payment",
      });
    if (payErr) {
      // Surface a friendly error but leave the package itself in place
      // — user can manually log the payment later.
      throw new Error(`PACKAGE_CREATED_PAYMENT_FAILED:${payErr.message}`);
    }
  }

  return pkg;
}

/** Delete a package. Owner-only. Sets lessons.package_id and
 *  payments.package_id to null on the way out (handled by FKs).
 */
export async function deletePackage(packageId: string) {
  const session = await getSession();
  requireRole(session, "owner");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("lesson_packages")
    .delete()
    .eq("id", packageId);
  if (error) throw error;
}

// ---------- reads -------------------------------------------------

/** All packages for one client, newest first, with computed
 *  used / remaining / paid_amount / is_expired.
 *  Owner + employee + the client themselves can read.
 */
export async function listClientPackages(
  clientId: string,
): Promise<PackageSummaryRow[]> {
  const session = await getSession();
  requireOwnerOrClientSelf(session, clientId);

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("lesson_package_summary")
    .select("*")
    .eq("client_id", clientId)
    .order("purchased_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PackageSummaryRow[];
}

/** Returns the package the calendar UI should suggest pre-checking
 *  when creating a lesson for this client: oldest non-expired with
 *  remaining > 0. Returns null if none qualify.
 */
export async function getActivePackageForClient(
  clientId: string,
): Promise<PackageSummaryRow | null> {
  const list = await listClientPackages(clientId);
  const active = list
    .filter((p) => !p.is_expired && p.lessons_remaining > 0)
    .sort((a, b) => +new Date(a.purchased_at) - +new Date(b.purchased_at));
  return active[0] ?? null;
}

/** One-shot: a {clientId -> active package} map for the whole stable.
 *  Used by the calendar page to feed every form's "Use package" toggle
 *  in a single round-trip instead of N+1 fetches. Staff-only.
 */
export async function listActivePackagesForStable(): Promise<
  Record<string, PackageSummaryRow>
> {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("lesson_package_summary")
    .select("*")
    .gt("lessons_remaining", 0)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("purchased_at", { ascending: true });
  if (error) throw error;

  // FIFO: oldest active package wins per client.
  const m: Record<string, PackageSummaryRow> = {};
  for (const r of (data ?? []) as PackageSummaryRow[]) {
    if (!m[r.client_id]) m[r.client_id] = r;
  }
  return m;
}
