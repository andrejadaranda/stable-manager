import { requirePageRole } from "@/lib/auth/redirects";
import { listExpenses } from "@/services/expenses";
import { listHorses } from "@/services/horses";
import { ExpenseList } from "@/components/expenses/expense-list";
import { CreateExpensePanel } from "@/components/expenses/create-expense-form";
import { PageHeader } from "@/components/ui";

export default async function ExpensesPage() {
  await requirePageRole("owner");

  const [expenses, horses] = await Promise.all([
    listExpenses(),
    listHorses(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Expenses"
        subtitle="Feed, vet, farrier, maintenance, and staff costs."
        actions={<CreateExpensePanel horses={horses ?? []} />}
      />
      <ExpenseList expenses={expenses} />
    </div>
  );
}
