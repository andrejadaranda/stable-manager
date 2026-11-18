"use server";

import { revalidatePath } from "next/cache";
import { createGiftVoucher, updateGiftVoucher, deleteGiftVoucher } from "@/services/giftVouchers";
import { toFriendlyError } from "@/lib/errors/friendly";

export type VoucherActionState = { error: string | null; success: boolean };
const initial: VoucherActionState = { error: null, success: false };

const num = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(",", ".").trim());
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const orNull = (s: string) => (s === "" ? null : s);

export async function createVoucherAction(
  _prev: VoucherActionState,
  formData: FormData,
): Promise<VoucherActionState> {
  const clientId = str(formData.get("client_id"));
  const code     = str(formData.get("code"));
  const issuedOn = str(formData.get("issued_on"));
  const amount   = num(formData.get("amount"));
  const lessonsRaw = str(formData.get("lessons"));
  const lessons  = lessonsRaw === "" ? null : Math.round(Number(lessonsRaw));

  if (!clientId) return { ...initial, error: "Missing client id." };
  if (!code) return { ...initial, error: "Įrašyk kupono numerį." };
  if (!Number.isFinite(amount) || amount < 0) return { ...initial, error: "Suma turi būti ≥ 0." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issuedOn)) return { ...initial, error: "Pasirink datą." };
  if (lessons !== null && (!Number.isFinite(lessons) || lessons < 0)) {
    return { ...initial, error: "Pamokų skaičius turi būti teigiamas." };
  }

  try {
    await createGiftVoucher({
      clientId,
      code,
      issuedOn,
      serviceLabel: orNull(str(formData.get("service_label"))),
      amount,
      paymentMethod: orNull(str(formData.get("payment_method"))),
      validUntil: orNull(str(formData.get("valid_until"))),
      paidOn: orNull(str(formData.get("paid_on"))),
      orderNo: orNull(str(formData.get("order_no"))),
      lessons,
    });
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  revalidatePath(`/dashboard/clients/${clientId}`);
  return { error: null, success: true };
}

export async function updateVoucherAction(
  _prev: VoucherActionState,
  formData: FormData,
): Promise<VoucherActionState> {
  const id       = str(formData.get("voucher_id"));
  const clientId = str(formData.get("client_id"));
  const code     = str(formData.get("code"));
  const issuedOn = str(formData.get("issued_on"));
  const amount   = num(formData.get("amount"));

  if (!id) return { ...initial, error: "Missing id." };
  if (!code) return { ...initial, error: "Įrašyk kupono numerį." };
  if (!Number.isFinite(amount) || amount < 0) return { ...initial, error: "Suma turi būti ≥ 0." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issuedOn)) return { ...initial, error: "Pasirink datą." };

  try {
    await updateGiftVoucher({
      id,
      code,
      issuedOn,
      serviceLabel: orNull(str(formData.get("service_label"))),
      amount,
      paymentMethod: orNull(str(formData.get("payment_method"))),
      validUntil: orNull(str(formData.get("valid_until"))),
      paidOn: orNull(str(formData.get("paid_on"))),
      orderNo: orNull(str(formData.get("order_no"))),
      redeemed: str(formData.get("redeemed")) === "true",
    });
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  if (clientId) revalidatePath(`/dashboard/clients/${clientId}`);
  return { error: null, success: true };
}

export async function deleteVoucherAction(
  _prev: VoucherActionState,
  formData: FormData,
): Promise<VoucherActionState> {
  const id       = str(formData.get("voucher_id"));
  const clientId = str(formData.get("client_id"));
  if (!id) return { ...initial, error: "Missing id." };

  try {
    await deleteGiftVoucher(id);
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  if (clientId) revalidatePath(`/dashboard/clients/${clientId}`);
  return { error: null, success: true };
}
