import { requirePageRole } from "@/lib/auth/redirects";
import { listExpenses } from "@/services/expenses";
import { listHorses } from "@/services/horses";
import { ExpenseList } from "@/components/expenses/expense-list";
import { CreateExpensePanel } from "@/components/expenses/create-expense-form";

export default async function ExpensesPage() {
  await requirePageRole("owner");

  const [expenses, horses] = await Promise.all([
    listExpenses(),
    listHorses(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Expenses</h1>
        <CreateExpensePanel horses={horses ?? []} />
      </div>
      <ExpenseList expenses={expenses} />
    </div>
  );
}
