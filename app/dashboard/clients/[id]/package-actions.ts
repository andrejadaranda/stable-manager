"use server";

// Server actions for managing lesson packages on a single client's
// detail page. Owner-only writes — RLS plus the service layer
// enforce this; the actions just translate form data.

import { revalidatePath } from "next/cache";
import { createPackage, deletePackage } from "@/services/packages";

export type PackageActionState = {
  error: string | null;
  success: boolean;
};

const initial: PackageActionState = { error: null, success: false };

export async function createPackageAction(
  _prev: PackageActionState,
  formData: FormData,
): Promise<PackageActionState> {
  const clientId  = String(formData.get("client_id")     ?? "");
  const totalRaw  = String(formData.get("total_lessons") ?? "");
  const priceRaw  = String(formData.get("price")         ?? "");
  const expiresR  = String(formData.get("expires_at")    ?? "").trim();
  const notes     = String(formData.get("notes")         ?? "").trim();
  const recordRaw = String(formData.get("record_payment") ?? "true");
  const methodRaw = String(formData.get("payment_method") ?? "cash");

  if (!clientId) return { ...initial, error: "Missing client id." };

  const totalLessons = Number.parseInt(totalRaw, 10);
  if (!Number.isFinite(totalLessons) || totalLessons <= 0) {
    return { ...initial, error: "Total lessons must be a positive whole number." };
  }

  const price = Number(priceRaw);
  if (!Number.isFinite(price) || price < 0) {
    return { ...initial, error: "Price must be a non-negative number." };
  }

  let expiresAt: string | null = null;
  if (expiresR) {
    const d = new Date(expiresR);
    if (Number.isNaN(d.getTime())) {
      return { ...initial, error: "Invalid expiry date." };
    }
    expiresAt = d.toISOString();
  }

  const method =
    methodRaw === "card" || methodRaw === "transfer" || methodRaw === "other"
      ? methodRaw
      : "cash";

  try {
    await createPackage({
      clientId,
      totalLessons,
      price,
      expiresAt,
      notes: notes || null,
      recordPayment: recordRaw !== "false",
      paymentMethod: method,
    });
  } catch (err: any) {
    const code = err?.message ?? "";
    if (code === "FORBIDDEN")              return { ...initial, error: "Only owners can create packages." };
    if (code === "UNAUTHENTICATED")        return { ...initial, error: "Your session expired. Sign in again." };
    if (code === "INVALID_PACKAGE_SIZE")   return { ...initial, error: "A package must include at least one lesson." };
    if (code === "INVALID_AMOUNT")         return { ...initial, error: "Price must be non-negative." };
    if (code === "INVALID_EXPIRY")         return { ...initial, error: "Expiry must be after the purchase date." };
    if (code.startsWith("PACKAGE_CREATED_PAYMENT_FAILED")) {
      // Package row exists but the upfront payment didn't write — surface
      // a clear hint so the owner can log the payment manually.
      return { ...initial, error: "Package created, but the payment couldn't be logged. Add it manually from Payments." };
    }
    return { ...initial, error: `Could not create package: ${code || "unknown error"}.` };
  }

  revalidatePath(`/dashboard/clients/${clientId}`);
  return { error: null, success: true };
}

export async function deletePackageAction(
  _prev: PackageActionState,
  formData: FormData,
): Promise<PackageActionState> {
  const packageId = String(formData.get("package_id") ?? "");
  const clientId  = String(formData.get("client_id")  ?? "");
  if (!packageId) return { ...initial, error: "Missing package id." };

  try {
    await deletePackage(packageId);
  } catch (err: any) {
    const code = err?.message ?? "";
    if (code === "FORBIDDEN")       return { ...initial, error: "Only owners can delete packages." };
    if (code === "UNAUTHENTICATED") return { ...initial, error: "Your session expired. Sign in again." };
    return { ...initial, error: `Could not delete: ${code || "unknown error"}.` };
  }

  if (clientId) revalidatePath(`/dashboard/clients/${clientId}`);
  return { error: null, success: true };
}
