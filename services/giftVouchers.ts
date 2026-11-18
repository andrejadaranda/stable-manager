// Gift-voucher register. A voucher is sold (often by a parent/buyer) and
// assigned to the recipient client. TRACKING data (code, service, amount,
// validity, buyer) lives in client_gift_vouchers; when the voucher is an
// "N lessons" subscription it is BACKED by a real lesson_package, so the
// lessons used / remaining count comes straight from the package and the
// owner redeems lessons through the existing "Use package" flow.
//
// This register never computes money on its own — the backing package's
// upfront payment is what records revenue at sale (see createPackage). Reads:
// owner + employee (staff) and the client themselves (RLS). Writes: owner.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole, requireOwnerOrClientSelf } from "@/lib/auth/session";
import { createPackage } from "@/services/packages";

export type GiftVoucher = {
  id: string;
  code: string;
  issued_on: string;          // YYYY-MM-DD
  service_label: string | null;
  amount: number;
  payment_method: string | null;
  valid_until: string | null; // YYYY-MM-DD
  paid_on: string | null;     // YYYY-MM-DD
  order_no: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  redeemed: boolean;
  notes: string | null;
  package_id: string | null;
  // Live counts from the backing package (null when the voucher isn't
  // lesson-backed — e.g. a plain money voucher).
  lessons_total: number | null;
  lessons_used: number | null;
  lessons_remaining: number | null;
  is_expired: boolean | null;
};

export async function listGiftVouchers(clientId: string): Promise<GiftVoucher[]> {
  const session = await getSession();
  requireOwnerOrClientSelf(session, clientId);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("client_gift_vouchers")
    .select("id, code, issued_on, service_label, amount, payment_method, valid_until, paid_on, order_no, buyer_email, buyer_phone, redeemed, notes, package_id")
    .eq("client_id", clientId)
    .order("issued_on", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as Array<Omit<GiftVoucher, "amount" | "lessons_total" | "lessons_used" | "lessons_remaining" | "is_expired"> & { amount: number | string }>;

  // Pull live lesson counts for the lesson-backed vouchers in one query.
  const pkgIds = rows.map((r) => r.package_id).filter(Boolean) as string[];
  const pkgById = new Map<string, { total_lessons: number; lessons_used: number; lessons_remaining: number; is_expired: boolean }>();
  if (pkgIds.length) {
    const { data: pkgs } = await supabase
      .from("lesson_package_summary")
      .select("id, total_lessons, lessons_used, lessons_remaining, is_expired")
      .in("id", pkgIds);
    for (const p of (pkgs ?? []) as Array<{ id: string; total_lessons: number | string; lessons_used: number | string; lessons_remaining: number | string; is_expired: boolean }>) {
      pkgById.set(p.id, {
        total_lessons: Number(p.total_lessons),
        lessons_used: Number(p.lessons_used),
        lessons_remaining: Number(p.lessons_remaining),
        is_expired: p.is_expired,
      });
    }
  }

  return rows.map((r) => {
    const pkg = r.package_id ? pkgById.get(r.package_id) : undefined;
    return {
      ...r,
      amount: Number(r.amount),
      lessons_total: pkg?.total_lessons ?? null,
      lessons_used: pkg?.lessons_used ?? null,
      lessons_remaining: pkg?.lessons_remaining ?? null,
      is_expired: pkg?.is_expired ?? null,
    };
  });
}

export type CreateVoucherInput = {
  clientId: string;
  code: string;
  issuedOn: string;            // YYYY-MM-DD
  serviceLabel?: string | null;
  amount: number;
  paymentMethod?: string | null;
  validUntil?: string | null;  // YYYY-MM-DD
  paidOn?: string | null;      // YYYY-MM-DD
  orderNo?: string | null;
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  notes?: string | null;
  /** When > 0, also create a backing lesson_package of this size so the
   *  voucher counts lessons used / remaining and plugs into "Use package".
   *  The package records the upfront payment (revenue at sale). */
  lessons?: number | null;
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export async function createGiftVoucher(input: CreateVoucherInput): Promise<{ id: string }> {
  const session = await getSession();
  requireRole(session, "owner");

  const code = input.code?.trim();
  if (!code) throw new Error("CODE_REQUIRED");
  if (!Number.isFinite(input.amount) || input.amount < 0) throw new Error("INVALID_AMOUNT");
  if (!YMD.test(input.issuedOn)) throw new Error("INVALID_DATE");
  if (input.validUntil && !YMD.test(input.validUntil)) throw new Error("INVALID_DATE");
  if (input.paidOn && !YMD.test(input.paidOn)) throw new Error("INVALID_DATE");

  const supabase = createSupabaseServerClient();

  // Optionally create the backing package first (records revenue via its
  // upfront payment). purchased_at = paid date (or issue date), expiry =
  // valid-until end of day so a same-day "valid until" still passes.
  let packageId: string | null = null;
  if (input.lessons && input.lessons > 0) {
    const purchasedAt = `${input.paidOn ?? input.issuedOn}T00:00:00.000Z`;
    const expiresAt = input.validUntil ? `${input.validUntil}T23:59:59.000Z` : null;
    const pkg = await createPackage({
      clientId: input.clientId,
      totalLessons: input.lessons,
      price: input.amount,
      purchasedAt,
      expiresAt,
      notes: `Gift voucher ${code}${input.serviceLabel ? ` · ${input.serviceLabel}` : ""}`,
      recordPayment: input.amount > 0,
      paymentMethod: "transfer",
    });
    packageId = (pkg as { id: string }).id;
  }

  const { data, error } = await supabase
    .from("client_gift_vouchers")
    .insert({
      stable_id:      session.stableId,
      client_id:      input.clientId,
      code,
      issued_on:      input.issuedOn,
      service_label:  input.serviceLabel ?? null,
      amount:         Math.round(input.amount * 100) / 100,
      payment_method: input.paymentMethod ?? null,
      valid_until:    input.validUntil ?? null,
      paid_on:        input.paidOn ?? null,
      order_no:       input.orderNo ?? null,
      buyer_email:    input.buyerEmail ?? null,
      buyer_phone:    input.buyerPhone ?? null,
      notes:          input.notes ?? null,
      package_id:     packageId,
      created_by:     session.userId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: (data as { id: string }).id };
}

export type UpdateVoucherInput = {
  id: string;
  code: string;
  issuedOn: string;
  serviceLabel?: string | null;
  amount: number;
  paymentMethod?: string | null;
  validUntil?: string | null;
  paidOn?: string | null;
  orderNo?: string | null;
  redeemed?: boolean;
  notes?: string | null;
};

export async function updateGiftVoucher(input: UpdateVoucherInput): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner");
  if (!input.id) throw new Error("MISSING_ID");
  const code = input.code?.trim();
  if (!code) throw new Error("CODE_REQUIRED");
  if (!Number.isFinite(input.amount) || input.amount < 0) throw new Error("INVALID_AMOUNT");
  if (!YMD.test(input.issuedOn)) throw new Error("INVALID_DATE");
  if (input.validUntil && !YMD.test(input.validUntil)) throw new Error("INVALID_DATE");
  if (input.paidOn && !YMD.test(input.paidOn)) throw new Error("INVALID_DATE");

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("client_gift_vouchers")
    .update({
      code,
      issued_on:      input.issuedOn,
      service_label:  input.serviceLabel ?? null,
      amount:         Math.round(input.amount * 100) / 100,
      payment_method: input.paymentMethod ?? null,
      valid_until:    input.validUntil ?? null,
      paid_on:        input.paidOn ?? null,
      order_no:       input.orderNo ?? null,
      redeemed:       input.redeemed ?? false,
      notes:          input.notes ?? null,
    })
    .eq("id", input.id);
  if (error) throw error;
}

/** Delete a voucher register row. The backing package (if any) is left in
 *  place so lessons already redeemed against it aren't disturbed; detach it
 *  from the package by removing the register row only. */
export async function deleteGiftVoucher(id: string): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("client_gift_vouchers").delete().eq("id", id);
  if (error) throw error;
}
