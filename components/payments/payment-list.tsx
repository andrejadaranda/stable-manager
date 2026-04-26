import type { PaymentRow } from "@/services/payments";
import { fmtDayLabel, fmtTime } from "@/lib/utils/dates";

const METHOD_DOT: Record<PaymentRow["method"], string> = {
  cash:     "bg-emerald-500",
  card:     "bg-blue-500",
  transfer: "bg-violet-500",
  other:    "bg-neutral-400",
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
    <div className="card overflow-hidden">
      <div
        className={`grid ${cols} gap-3 px-6 py-3 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400`}
      >
        {showClientName && <div>Client</div>}
        <div>Amount</div>
        <div>Date</div>
        <div>Lesson</div>
        <div>Method</div>
        <div>Notes</div>
      </div>
      <ul>
        {payments.map((p) => (
          <li
            key={p.id}
            className={`grid ${cols} gap-3 px-6 py-4 text-sm items-center hover:bg-neutral-50/70 transition-colors`}
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
              <MethodTag method={p.method} />
            </div>
            <div className="text-neutral-500 truncate">{p.notes ?? <Dash />}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Dash() {
  return <span className="text-neutral-300">—</span>;
}

function MethodTag({ method }: { method: PaymentRow["method"] }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs capitalize">
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${METHOD_DOT[method]}`} />
      <span className="text-neutral-700">{method}</span>
    </span>
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
