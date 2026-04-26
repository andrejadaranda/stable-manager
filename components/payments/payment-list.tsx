import type { PaymentRow } from "@/services/payments";
import { fmtDayLabel, fmtTime } from "@/lib/utils/dates";

const METHOD_STYLES: Record<PaymentRow["method"], string> = {
  cash:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  card:     "bg-blue-50    text-blue-700    border-blue-200",
  transfer: "bg-violet-50  text-violet-700  border-violet-200",
  other:    "bg-neutral-100 text-neutral-700 border-neutral-200",
};

export function PaymentList({
  payments,
  showClientName,
}: {
  payments: PaymentRow[];
  showClientName: boolean;
}) {
  if (payments.length === 0) {
    return (
      <EmptyState
        title="No payments recorded yet"
        body={
          showClientName
            ? 'Use "+ New payment" to record one.'
            : "Once your stable owner records a payment for you, it will appear here."
        }
      />
    );
  }

  const cols = showClientName
    ? "grid-cols-[1.4fr_0.8fr_1fr_1.6fr_0.9fr_1.4fr]"
    : "grid-cols-[0.8fr_1fr_1.6fr_0.9fr_1.4fr]";

  return (
    <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
      <div
        className={`grid ${cols} gap-3 px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-neutral-500 bg-neutral-50 border-b border-neutral-200`}
      >
        {showClientName && <div>Client</div>}
        <div>Amount</div>
        <div>Date</div>
        <div>Lesson</div>
        <div>Method</div>
        <div>Notes</div>
      </div>
      <ul className="divide-y divide-neutral-200">
        {payments.map((p) => (
          <li
            key={p.id}
            className={`grid ${cols} gap-3 px-5 py-3.5 text-sm items-center hover:bg-neutral-50 transition-colors`}
          >
            {showClientName && (
              <div className="font-semibold text-neutral-900">
                {p.client?.full_name ?? <Dash />}
              </div>
            )}
            <div className="font-semibold text-neutral-900 tabular-nums">
              {Number(p.amount).toFixed(2)}
            </div>
            <div className="text-neutral-700">
              {fmtDayLabel(new Date(p.paid_at))}
            </div>
            <div className="text-neutral-700">
              {p.lesson ? (
                <span>
                  {fmtDayLabel(new Date(p.lesson.starts_at))} ·{" "}
                  {fmtTime(p.lesson.starts_at)}
                  {p.lesson.horse ? ` · ${p.lesson.horse.name}` : ""}
                </span>
              ) : (
                <Dash />
              )}
            </div>
            <div>
              <MethodPill method={p.method} />
            </div>
            <div className="text-neutral-600 truncate">{p.notes ?? <Dash />}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Dash() {
  return <span className="text-neutral-400">—</span>;
}

function MethodPill({ method }: { method: PaymentRow["method"] }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${METHOD_STYLES[method]}`}
    >
      {method}
    </span>
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
