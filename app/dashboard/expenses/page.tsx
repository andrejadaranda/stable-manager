import { requirePageRole } from "@/lib/auth/redirects";
import { listExpenses } from "@/services/expenses";
import { listHorses } from "@/services/horses";
import { ExpenseList } from "@/components/expenses/expense-list";
import { CreateExpensePanel } from "@/components/expenses/create-expense-form";
// Reusing the payments export button — same shape (date range → PDF
// print view), just pointed at the expenses report. Co-locating
// would require an arbitrary "shared" directory for a single component.
import { ExportPdfButton } from "@/components/payments/export-pdf-button";
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
        actions={
          <div className="flex items-center gap-2">
            <ExportPdfButton basePath="/dashboard/expenses/export" />
            <CreateExpensePanel horses={horses ?? []} />
          </div>
        }
      />
      <ExpenseList expenses={expenses} />
    </div>
  );
}
