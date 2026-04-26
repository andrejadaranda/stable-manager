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

const CATEGORY_BADGE: Record<ExpenseCategory, string> = {
  feed:        "bg-amber-50  text-amber-800  border-amber-200",
  vet:         "bg-rose-50   text-rose-800   border-rose-200",
  farrier:     "bg-blue-50   text-blue-800   border-blue-200",
  maintenance: "bg-slate-50  text-slate-800  border-slate-200",
  staff:       "bg-violet-50 text-violet-800 border-violet-200",
  other:       "bg-neutral-50 text-neutral-700 border-neutral-200",
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
    <div className="flex flex-col gap-3">
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

      <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
        <div className="grid grid-cols-[1fr_0.8fr_1fr_1.2fr_1.6fr] gap-3 px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-neutral-500 bg-neutral-50 border-b border-neutral-200">
          <div>Category</div>
          <div>Amount</div>
          <div>Date</div>
          <div>Horse</div>
          <div>Notes</div>
        </div>
        <ul className="divide-y divide-neutral-200">
          {expenses.map((e) => (
            <li
              key={e.id}
              className="grid grid-cols-[1fr_0.8fr_1fr_1.2fr_1.6fr] gap-3 px-5 py-3.5 text-sm items-center hover:bg-neutral-50 transition-colors"
            >
              <div>
                <span
                  className={`inline-block text-xs px-2 py-0.5 rounded-full border font-medium ${CATEGORY_BADGE[e.category]}`}
                >
                  {CATEGORY_LABEL[e.category]}
                </span>
              </div>
              <div className="font-semibold text-neutral-900 tabular-nums">
                {Number(e.amount).toFixed(2)}
              </div>
              <div className="text-neutral-700">
                {fmtDayLabel(new Date(e.incurred_on))}
              </div>
              <div className="text-neutral-700">
                {e.horse?.name ?? <span className="text-neutral-400">—</span>}
              </div>
              <div className="text-neutral-600 truncate">
                {e.description ?? <span className="text-neutral-400">—</span>}
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
    <div className="border border-dashed border-neutral-300 rounded-lg bg-white p-10 text-center">
      <p className="text-sm font-semibold text-neutral-800">{title}</p>
      <p className="text-xs text-neutral-500 mt-1">{body}</p>
    </div>
  );
}
