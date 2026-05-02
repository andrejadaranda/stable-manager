import type { PaymentRow } from "@/services/payments";
import { fmtDayLabel, fmtTime } from "@/lib/utils/dates";
import { EmptyState, Badge } from "@/components/ui";

const METHOD_TONE: Record<PaymentRow["method"], "success" | "info" | "brand" | "muted"> = {
  cash:     "success",
  card:     "info",
  transfer: "brand",
  other:    "muted",
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
        title="No payments yet"
        body={
          showClientName
            ? "Record a payment to start tracking client balances. Cash, card, and transfer all supported."
            : "Once your stable records a payment for you, it will appear here automatically."
        }
        primary={
          showClientName
            ? { label: "Record a payment", href: "/dashboard/payments?new=1" }
            : undefined
        }
      />
    );
  }

  const cols = showClientName
    ? "md:grid-cols-[1.4fr_0.8fr_1fr_1.6fr_0.9fr_1.4fr]"
    : "md:grid-cols-[0.8fr_1fr_1.6fr_0.9fr_1.4fr]";

  return (
    <div className="card overflow-hidden">
      <div
        className={`hidden md:grid ${cols} gap-3 px-5 py-3 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400`}
      >
        {showClientName && <div>Client</div>}
        <div>Amount</div>
        <div>Date</div>
        <div>Lesson</div>
        <div>Method</div>
        <div>Notes</div>
      </div>
      <ul className="divide-y divide-ink-100/60 md:divide-y-0">
        {payments.map((p) => (
          <li
            key={p.id}
            className={`block md:grid ${cols} gap-3 px-4 md:px-5 py-3.5 md:py-4 text-sm md:items-center hover:bg-neutral-50/70 transition-colors`}
          >
            {/* Mobile: amount + method on row 1, client + date row 2, lesson row 3 */}
            <div className="flex items-baseline justify-between md:hidden">
              <span className="font-semibold text-navy-900 text-base tabular-nums">
                €{Number(p.amount).toFixed(2)}
              </span>
              <MethodTag method={p.method} />
            </div>
            {showClientName && (
              <div className="font-semibold text-neutral-900 truncate hidden md:block">
                {p.client?.full_name ?? <Dash />}
              </div>
            )}
            <div className="hidden md:block font-semibold text-neutral-900 tabular-nums">
              {Number(p.amount).toFixed(2)}
            </div>
            <div className="hidden md:block text-neutral-700">
              {fmtDayLabel(new Date(p.paid_at))}
            </div>
            <div className="hidden md:block text-neutral-700">
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
            <div className="hidden md:block">
              <MethodTag method={p.method} />
            </div>
            <div className="hidden md:block text-neutral-500 truncate">{p.notes ?? <Dash />}</div>

            {/* Mobile-only meta */}
            <div className="md:hidden mt-1 text-[12.5px] text-neutral-600 flex flex-wrap gap-x-3 gap-y-0.5">
              {showClientName && (
                <span className="font-medium text-neutral-800 truncate max-w-[14rem]">
                  {p.client?.full_name ?? "—"}
                </span>
              )}
              <span className="text-neutral-500">{fmtDayLabel(new Date(p.paid_at))}</span>
              {p.lesson && (
                <span className="text-neutral-500 truncate max-w-[16rem]">
                  · {fmtTime(p.lesson.starts_at)}
                  {p.lesson.horse ? ` · ${p.lesson.horse.name}` : ""}
                </span>
              )}
            </div>
            {p.notes && (
              <p className="md:hidden mt-1 text-[12px] text-neutral-500 truncate">{p.notes}</p>
            )}
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
    <Badge tone={METHOD_TONE[method]} dot className="capitalize">
      {method}
    </Badge>
  );
}
