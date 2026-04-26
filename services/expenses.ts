// Expenses service — owner-only on every path.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";

export type ExpenseCategory =
  | "feed"
  | "vet"
  | "farrier"
  | "maintenance"
  | "staff"
  | "other";

export type AddExpenseInput = {
  category: ExpenseCategory;
  amount: number;
  description?: string;
  horseId?: string | null;
  incurredOn?: string;  // YYYY-MM-DD; defaults to today
};

export async function addExpense(input: AddExpenseInput) {
  const session = await getSession();
  requireRole(session, "owner");
  if (input.amount <= 0) throw new Error("INVALID_AMOUNT");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      stable_id: session.stableId,
      category: input.category,
      amount: input.amount,
      description: input.description ?? null,
      horse_id: input.horseId ?? null,
      incurred_on: input.incurredOn ?? new Date().toISOString().slice(0, 10),
      created_by: session.userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Expense row with horse name joined for display.
export type ExpenseRow = {
  id: string;
  stable_id: string;
  category: ExpenseCategory;
  amount: number;
  description: string | null;
  horse_id: string | null;
  incurred_on: string;
  created_by: string | null;
  created_at: string;
  horse: { id: string; name: string } | null;
};

// Owner only. `from` and `to` are optional ISO date strings (YYYY-MM-DD)
// defining a half-open window. Omit both for the full ledger.
export async function listExpenses(opts?: {
  from?: string;
  to?: string;
}): Promise<ExpenseRow[]> {
  const session = await getSession();
  requireRole(session, "owner");

  const supabase = createSupabaseServerClient();
  let q = supabase
    .from("expenses")
    .select(
      `
      id, stable_id, category, amount, description, horse_id, incurred_on, created_by, created_at,
      horse:horses(id, name)
      `,
    )
    .order("incurred_on", { ascending: false });
  if (opts?.from) q = q.gte("incurred_on", opts.from);
  if (opts?.to)   q = q.lt("incurred_on",  opts.to);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as ExpenseRow[];
}
