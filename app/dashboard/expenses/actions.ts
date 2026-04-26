"use server";

import { revalidatePath } from "next/cache";
import { addExpense, type ExpenseCategory } from "@/services/expenses";

export type AddExpenseState = { error: string | null; success: boolean };

const initial: AddExpenseState = { error: null, success: false };

const CATEGORIES: ExpenseCategory[] = [
  "feed",
  "vet",
  "farrier",
  "maintenance",
  "staff",
  "other",
];

export async function addExpenseAction(
  _prev: AddExpenseState,
  formData: FormData,
): Promise<AddExpenseState> {
  const category   = String(formData.get("category") ?? "");
  const amountRaw  = String(formData.get("amount") ?? "").trim();
  const incurredOn = String(formData.get("incurred_on") ?? "");   // YYYY-MM-DD
  const horseId    = String(formData.get("horse_id") ?? "");
  const notes      = String(formData.get("notes") ?? "").trim();

  if (!CATEGORIES.includes(category as ExpenseCategory)) {
    return { error: "Pick a valid category.", success: false };
  }
  if (!amountRaw)  return { error: "Amount is required.", success: false };
  if (!incurredOn) return { error: "Date is required.",   success: false };

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Amount must be a positive number.", success: false };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(incurredOn)) {
    return { error: "Date must be YYYY-MM-DD.", success: false };
  }

  try {
    await addExpense({
      category: category as ExpenseCategory,
      amount,
      incurredOn,
      horseId: horseId || null,
      description: notes || undefined,
    });
  } catch (err: any) {
    const message = err?.message ?? "";
    if (message === "FORBIDDEN")        return { error: "Only owners can record expenses.",     success: false };
    if (message === "INVALID_AMOUNT")   return { error: "Amount must be a positive number.",    success: false };
    if (message === "UNAUTHENTICATED")  return { error: "Your session expired. Sign in again.", success: false };
    return { error: `Could not record expense: ${message || "unknown error"}.`, success: false };
  }

  revalidatePath("/dashboard/expenses");
  return { error: null, success: true };
}

