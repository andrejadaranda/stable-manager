import type { ExpenseRow, ExpenseCategory } from "@/services/expenses";
import { EmptyState } from "@/components/ui";

const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  feed: "Feed", hay: "Hay", bedding: "Bedding", supplements: "Supplements",
  vet: "Vet", farrier: "Farrier", tack: "Tack", equipment: "Equipment",
  repair: "Repair", maintenance: "Maintenance", insurance: "Insurance",
  competition: "Competition", transport: "Transport", utilities: "Utilities",
  registration: "Registration", staff: "Staff", other: "Other",
};

// Per-category colours: fill (solid bar/dot) + tile (icon background/text).
const CAT: Record<ExpenseCategory, { fill: string; tile: string; text: string }> = {
  feed:        { fill: "bg-brand-500",  tile: "bg-brand-100",  text: "text-brand-700" },
  hay:         { fill: "bg-brand-500",  tile: "bg-brand-100",  text: "text-brand-700" },
  bedding:     { fill: "bg-brand-400",  tile: "bg-brand-100",  text: "text-brand-700" },
  supplements: { fill: "bg-emerald-500",tile: "bg-emerald-100",text: "text-emerald-700" },
  vet:         { fill: "bg-sky-500",    tile: "bg-sky-100",    text: "text-sky-700" },
  farrier:     { fill: "bg-saddle-500", tile: "bg-saddle-100", text: "text-saddle-700" },
  tack:        { fill: "bg-saddle-400", tile: "bg-saddle-100", text: "text-saddle-700" },
  equipment:   { fill: "bg-ink-400",    tile: "bg-ink-100",    text: "text-ink-600" },
  repair:      { fill: "bg-rose-500",   tile: "bg-rose-100",   text: "text-rose-700" },
  maintenance: { fill: "bg-ink-500",    tile: "bg-ink-100",    text: "text-ink-600" },
  insurance:   { fill: "bg-navy-400",   tile: "bg-navy-100",   text: "text-navy-700" },
  competition: { fill: "bg-amber-500",  tile: "bg-amber-100",  text: "text-amber-700" },
  transport:   { fill: "bg-ink-400",    tile: "bg-ink-100",    text: "text-ink-600" },
  utilities:   { fill: "bg-sky-400",    tile: "bg-sky-100",    text: "text-sky-700" },
  registration:{ fill: "bg-ink-400",    tile: "bg-ink-100",    text: "text-ink-600" },
  staff:       { fill: "bg-navy-500",   tile: "bg-navy-100",   text: "text-navy-700" },
  other:       { fill: "bg-ink-400",    tile: "bg-ink-100",    text: "text-ink-600" },
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

  // Category breakdown from the rows themselves — no extra query needed.
  const byCat = new Map<ExpenseCategory, number>();
  for (const e of expenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + Number(e.amount));
  const cats = Array.from(byCat.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Day groups (newest first — expenses arrive ordered by incurred_on desc).
  const groups: { key: string; label: string; rows: ExpenseRow[] }[] = [];
  const byKey = new Map<string, { key: string; label: string; rows: ExpenseRow[] }>();
  for (const e of expenses) {
    const d = new Date(e.incurred_on);
    const key = d.toLocaleDateString("en-CA", { timeZone: "Europe/Vilnius" });
    let g = byKey.get(key);
    if (!g) {
      g = { key, label: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", timeZone: "Europe/Vilnius" }), rows: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    g.rows.push(e);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Green summary hero */}
      <div className="relative overflow-hidden rounded-3xl p-5 text-brand-50 shadow-lift bg-gradient-to-br from-brand-700 to-brand-900">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-saddle-200">Total spent</span>
          <span className="text-[13px] font-semibold text-brand-100">{expenses.length} {expenses.length === 1 ? "entry" : "entries"}</span>
        </div>
        <div className="font-mono font-semibold text-[40px] leading-none mt-3 tabular-nums">
          €{total.toFixed(0)}
        </div>
        <div className="text-[12px] text-brand-200 mt-1.5">money out</div>
      </div>

      {/* Category breakdown */}
      {cats.length > 0 && (
        <div className="bg-white border border-ink-100 rounded-2xl shadow-soft p-5">
          <div className="text-[13px] font-bold text-ink-700 mb-3">Where it went</div>
          <div className="flex flex-col gap-3">
            {cats.map((c) => {
              const pct = total > 0 ? Math.round((c.amount / total) * 100) : 0;
              const meta = CAT[c.category];
              return (
                <div key={c.category} className="flex items-center gap-3">
                  <span className={`w-[9px] h-[9px] rounded-full shrink-0 ${meta.fill}`} />
                  <span className="text-[14px] font-semibold text-ink-800 w-[110px] shrink-0 truncate">{CATEGORY_LABEL[c.category]}</span>
                  <span className="flex-1 h-1.5 rounded-full bg-surface-sunken overflow-hidden">
                    <span className={`block h-full rounded-full ${meta.fill}`} style={{ width: `${pct}%` }} />
                  </span>
                  <span className="font-mono font-semibold text-[14px] text-ink-900 tabular-nums shrink-0">€{c.amount.toFixed(0)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Day-grouped entries */}
      {groups.map((g) => (
        <div key={g.key}>
          <div className="text-[13px] font-bold text-ink-600 mb-2 px-1">{g.label}</div>
          <ul className="bg-white border border-ink-100 rounded-2xl shadow-soft divide-y divide-ink-100 overflow-hidden">
            {g.rows.map((e) => {
              const meta = CAT[e.category];
              const primary = e.description || CATEGORY_LABEL[e.category];
              return (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3.5">
                  <span className={`w-10 h-10 rounded-xl shrink-0 inline-flex items-center justify-center ${meta.tile} ${meta.text}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 12V8H6a2 2 0 0 1 0-4h12v4" /><path d="M4 6v12a2 2 0 0 0 2 2h14v-4" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-bold text-[15px] text-ink-900 truncate">{primary}</span>
                      <span className="font-mono font-semibold text-[15px] text-ink-900 tabular-nums shrink-0">−€{Number(e.amount).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[13px] text-ink-500 mt-0.5 min-w-0">
                      <span className={`inline-flex items-center gap-1.5 font-semibold shrink-0 ${meta.text}`}>
                        <span className={`w-[7px] h-[7px] rounded-full ${meta.fill}`} />
                        {CATEGORY_LABEL[e.category]}
                      </span>
                      {e.horse?.name && (
                        <>
                          <span className="text-ink-300">·</span>
                          <span className="truncate">{e.horse.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
