import type { ExpenseRow, ExpenseCategory } from "@/services/expenses";
import { fmtDayLabel } from "@/lib/utils/dates";

const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  feed:        "Feed",
  vet:         "Vet",
  farrier:     "Farrier",
  maintenance: "Maintenance",
  staff:       "Staff",
  other:       "Other",
};

const CATEGORY_DOT: Record<ExpenseCategory, string> = {
  feed:        "bg-amber-500",
  vet:         "bg-rose-500",
  farrier:     "bg-blue-500",
  maintenance: "bg-slate-500",
  staff:       "bg-violet-500",
  other:       "bg-neutral-400",
};

export function ExpenseList({ expenses }: { expenses: ExpenseRow[] }) {
  if (expenses.length === 0) {
    return (
      <EmptyState
        title="No expenses recorded yet"
        body='Use "+ New expense" to record one.'
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
        <div className="grid grid-cols-[1fr_0.8fr_1fr_1.2fr_1.6fr] gap-3 px-6 py-3 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400">
          <div>Category</div>
          <div>Amount</div>
          <div>Date</div>
          <div>Horse</div>
          <div>Notes</div>
        </div>
        <ul>
          {expenses.map((e) => (
            <li
              key={e.id}
              className="grid grid-cols-[1fr_0.8fr_1fr_1.2fr_1.6fr] gap-3 px-6 py-4 text-sm items-center hover:bg-neutral-50/70 transition-colors"
            >
              <div className="inline-flex items-center gap-2">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${CATEGORY_DOT[e.category]}`} />
                <span className="text-neutral-700">{CATEGORY_LABEL[e.category]}</span>
              </div>
              <div className="font-semibold text-neutral-900 tabular-nums">
                {Number(e.amount).toFixed(2)}
              </div>
              <div className="text-neutral-700">
                {fmtDayLabel(new Date(e.incurred_on))}
              </div>
              <div className="text-neutral-700">
                {e.horse?.name ?? <span className="text-neutral-300">—</span>}
              </div>
              <div className="text-neutral-500 truncate">
                {e.description ?? <span className="text-neutral-300">—</span>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-12 text-center">
      <p className="text-base font-semibold text-neutral-800">{title}</p>
      <p className="text-sm text-neutral-500 mt-1.5">{body}</p>
    </div>
  );
}
