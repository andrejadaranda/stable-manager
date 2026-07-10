import type { PaymentRow } from "@/services/payments";
import { fmtTime } from "@/lib/utils/dates";
import { EmptyState } from "@/components/ui";
import { PaymentRowActions } from "./payment-row-actions";

type Method = PaymentRow["method"];

const METHOD: Record<Method, { label: string; tile: string; dot: string; label_cls: string }> = {
  cash:     { label: "Cash",     tile: "bg-brand-100 text-brand-700",   dot: "bg-brand-500",  label_cls: "text-brand-700" },
  card:     { label: "Card",     tile: "bg-sky-100 text-sky-700",       dot: "bg-sky-500",    label_cls: "text-sky-700" },
  transfer: { label: "Transfer", tile: "bg-saddle-100 text-saddle-700", dot: "bg-saddle-500", label_cls: "text-saddle-700" },
  other:    { label: "Other",    tile: "bg-ink-100 text-ink-600",       dot: "bg-ink-400",    label_cls: "text-ink-500" },
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

  // Group by calendar day (Vilnius) for the day-separated ledger.
  const groups: { key: string; label: string; rows: PaymentRow[] }[] = [];
  const byKey = new Map<string, { key: string; label: string; rows: PaymentRow[] }>();
  for (const p of payments) {
    const d = new Date(p.paid_at);
    const key = d.toLocaleDateString("en-CA", { timeZone: "Europe/Vilnius" });
    let g = byKey.get(key);
    if (!g) {
      g = {
        key,
        label: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", timeZone: "Europe/Vilnius" }),
        rows: [],
      };
      byKey.set(key, g);
      groups.push(g);
    }
    g.rows.push(p);
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g.key}>
          <div className="text-[13px] font-bold text-ink-600 mb-2 px-1">{g.label}</div>
          <ul className="bg-white border border-ink-100 rounded-2xl shadow-soft divide-y divide-ink-100 overflow-hidden">
            {g.rows.map((p) => {
              const m = METHOD[p.method] ?? METHOD.other;
              const desc = p.lesson
                ? `${fmtTime(p.lesson.starts_at)} lesson${p.lesson.horse ? ` · ${p.lesson.horse.name}` : ""}`
                : (p.notes ?? "Payment");
              const primary = showClientName ? (p.client?.full_name ?? "—") : desc;
              return (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3.5">
                  <span className={`w-10 h-10 rounded-xl shrink-0 inline-flex items-center justify-center ${m.tile}`}>
                    <MethodIcon method={p.method} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-bold text-[15px] text-ink-900 truncate">{primary}</span>
                      <span className="font-mono font-semibold text-[15px] text-ink-900 tabular-nums shrink-0">
                        €{Number(p.amount).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[13px] text-ink-500 mt-0.5 min-w-0">
                      <span className={`inline-flex items-center gap-1.5 font-semibold shrink-0 ${m.label_cls}`}>
                        <span className={`w-[7px] h-[7px] rounded-full ${m.dot}`} />
                        {m.label}
                      </span>
                      {showClientName && (
                        <>
                          <span className="text-ink-300">·</span>
                          <span className="truncate">{desc}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {showClientName && (
                    <PaymentRowActions payment={{ id: p.id, amount: p.amount, method: p.method, paid_at: p.paid_at, notes: p.notes }} />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function MethodIcon({ method }: { method: Method }) {
  if (method === "card") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
    );
  }
  if (method === "transfer") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 7h11l-3-3M17 17H6l3 3" /></svg>
    );
  }
  // cash / other → banknote
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>
  );
}
