import type { ExpenseRow, ExpenseCategory } from "@/services/expenses";
import { fmtDayLabel } from "@/lib/utils/dates";
import { EmptyState, Badge } from "@/components/ui";

const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  feed:        "Feed",
  vet:         "Vet",
  farrier:     "Farrier",
  maintenance: "Maintenance",
  staff:       "Staff",
  other:       "Other",
};

const CATEGORY_TONE: Record<ExpenseCategory, "warning" | "danger" | "info" | "neutral" | "brand" | "muted"> = {
  feed:        "warning",
  vet:         "danger",
  farrier:     "info",
  maintenance: "neutral",
  staff:       "brand",
  other:       "muted",
};

export function ExpenseList({ expenses }: { expenses: ExpenseRow[] }) {
  if (expenses.length === 0) {
    return (
      <EmptyState
        title="No expenses recorded yet"
        body="Track feed, vet, farrier, maintenance, and staff costs to see your real monthly margin."
        primary={{ label: "Add an expense", href: "/dashboard/expenses?new=1" }}
      />
    );
  }

  const total = expenses.reduce((acc, e) => acc + Number(e.amount), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3 text-sm">
        <span>
          <span className="font-semibold text-neutral-900 tabular-nums">
            {expenses.length}
          </span>
          <span className="text-neutral-500 ml-1">
            {expenses.length === 1 ? "entry" : "entries"}
          </span>
        </span>
        <span className="text-neutral-300">·</span>
        <span>
          <span className="text-neutral-500">Total</span>
          <span className="ml-2 font-semibold text-neutral-900 tabular-nums">
            {total.toFixed(2)}
          </span>
        </span>
      </div>

      <div className="card overflow-hidden">
        <div className="hidden md:grid grid-cols-[1fr_0.8fr_1fr_1.2fr_1.6fr] gap-3 px-5 py-3 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400">
          <div>Category</div>
          <div>Amount</div>
          <div>Date</div>
          <div>Horse</div>
          <div>Notes</div>
        </div>
        <ul className="divide-y divide-ink-100/60 md:divide-y-0">
          {expenses.map((e) => (
            <li
              key={e.id}
              className="
                block px-4 md:px-5 py-3.5 md:py-4 text-sm
                md:grid md:grid-cols-[1fr_0.8fr_1fr_1.2fr_1.6fr] md:gap-3 md:items-center
                hover:bg-neutral-50/70 transition-colors
              "
            >
              <div className="flex items-baseline justify-between md:hidden mb-1">
                <Badge tone={CATEGORY_TONE[e.category]} dot>
                  {CATEGORY_LABEL[e.category]}
                </Badge>
                <span className="font-semibold text-navy-900 tabular-nums">
                  €{Number(e.amount).toFixed(2)}
                </span>
              </div>
              <div className="hidden md:block">
                <Badge tone={CATEGORY_TONE[e.category]} dot>
                  {CATEGORY_LABEL[e.category]}
                </Badge>
              </div>
              <div className="hidden md:block font-semibold text-neutral-900 tabular-nums">
                {Number(e.amount).toFixed(2)}
              </div>
              <div className="hidden md:block text-neutral-700">
                {fmtDayLabel(new Date(e.incurred_on))}
              </div>
              <div className="hidden md:block text-neutral-700">
                {e.horse?.name ?? <span className="text-neutral-300">—</span>}
              </div>
              <div className="hidden md:block text-neutral-500 truncate">
                {e.description ?? <span className="text-neutral-300">—</span>}
              </div>

              {/* Mobile-only meta */}
              <div className="md:hidden flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-neutral-600">
                <span>{fmtDayLabel(new Date(e.incurred_on))}</span>
                {e.horse?.name && <span className="text-neutral-500">· {e.horse.name}</span>}
              </div>
              {e.description && (
                <p className="md:hidden mt-1 text-[12px] text-neutral-500 truncate">{e.description}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

