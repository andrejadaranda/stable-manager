// "Outstanding" summary on the horse profile Overview — total owed at a
// glance, broken down by what for (boarding, farrier/vet, other).

import type { HorseOutstanding } from "@/services/horseBalance.pure";

function eur(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function HorseOutstandingCard({ outstanding }: { outstanding: HorseOutstanding }) {
  if (outstanding.total_cents <= 0) {
    return (
      <div className="rounded-2xl p-4 bg-white border border-ink-100 flex items-center justify-between gap-3"
        style={{ borderLeft: "3px solid #5A7A3A" }}>
        <div>
          <div className="text-[10.5px] tracking-[0.04em] uppercase text-ink-500">Outstanding</div>
          <div className="text-[15px] font-medium text-ink-900 mt-1">All settled</div>
        </div>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold bg-emerald-100 text-emerald-800">€0.00</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-4 bg-white border border-ink-100" style={{ borderLeft: "3px solid #C2841A" }}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10.5px] tracking-[0.04em] uppercase text-ink-500">Outstanding</div>
        <span className="text-lg font-semibold tabular-nums text-navy-900">{eur(outstanding.total_cents)}</span>
      </div>
      <ul className="mt-2.5 flex flex-col gap-1.5">
        {outstanding.lines.map((l) => (
          <li key={l.label} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="text-ink-700">
              {l.label}
              {l.detail ? <span className="text-ink-400"> · {l.detail}</span> : null}
            </span>
            <span className="font-medium tabular-nums text-navy-900">{eur(l.cents)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
