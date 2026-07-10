"use client";

// Finance dashboard shell — month picker + KPI strip + breakdown
// panels. Server fetches all numbers in one call; this component is
// just presentation + month navigation.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { MonthFinancials } from "@/services/finance";
import { HelpHint } from "@/components/ui";

// Pin the locale so server + client render the same string (an undefined
// locale renders with the machine's locale → hydration mismatch #425/#422).
const FMT_EUR = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
});

const EXPENSE_LABEL: Record<string, string> = {
  feed:        "Feed",
  hay:         "Hay",
  bedding:     "Bedding",
  vet:         "Vet",
  farrier:     "Farrier",
  supplements: "Supplements",
  tack:        "Tack",
  equipment:   "Equipment",
  repair:      "Repair",
  maintenance: "Maintenance",
  staff:       "Staff",
  insurance:   "Insurance",
  utilities:   "Utilities",
  transport:   "Transport",
  competition: "Competition",
  registration:"Registration",
  other:       "Other",
};

const CATEGORY_TONE: Record<string, string> = {
  lessons:       "bg-brand-50 text-brand-700",
  packages:      "bg-emerald-50 text-emerald-700",
  boarding:      "bg-sky-50 text-sky-700",
  uncategorized: "bg-ink-100 text-ink-700",
  feed:          "bg-amber-50 text-amber-700",
  vet:           "bg-rose-50 text-rose-700",
  farrier:       "bg-violet-50 text-violet-700",
  maintenance:   "bg-sky-50 text-sky-700",
  staff:         "bg-navy-50 text-navy-700",
  other:         "bg-ink-100 text-ink-700",
};

// Solid bar-fill colour per source/category key (progress tracks).
const CATEGORY_FILL: Record<string, string> = {
  lessons:       "bg-sky-500",
  packages:      "bg-brand-600",
  boarding:      "bg-saddle-500",
  uncategorized: "bg-ink-400",
  feed:          "bg-saddle-600",
  hay:           "bg-saddle-500",
  bedding:       "bg-saddle-400",
  vet:           "bg-rose-500",
  farrier:       "bg-violet-500",
  supplements:   "bg-emerald-500",
  tack:          "bg-amber-500",
  equipment:     "bg-ink-500",
  maintenance:   "bg-sky-500",
  staff:         "bg-navy-500",
  other:         "bg-ink-400",
};

export function FinanceShell({ data }: { data: MonthFinancials }) {
  const router = useRouter();
  const sp = useSearchParams();

  function changePeriod(p: string) {
    const params = new URLSearchParams(sp);
    params.set("period", p);
    router.replace(`?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Hero ------------------------------------------------- */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div className="min-w-0 flex flex-col items-start">
          <Link
            href="/dashboard"
            className="text-[12px] text-ink-500 hover:text-ink-900 inline-flex items-center gap-1"
          >
            ← Dashboard
          </Link>
          <h1 className="font-display text-3xl md:text-4xl text-navy-900 leading-none mt-2 flex items-center gap-2">
            Finance
            <HelpHint
              title="How Finance is calculated"
              body={
                <>
                  <p><strong>Revenue</strong> = paid lessons + paid packages + paid boarding charges. Only payments marked <em>paid</em> count.</p>
                  <p><strong>Expenses</strong> = entries from the Expenses page (feed, vet, farrier, maintenance, staff, other).</p>
                  <p><strong>Net</strong> = Revenue − Expenses for the selected month.</p>
                  <p>Use the month picker on the right to look back at any prior month. Per-horse profit splits revenue and expenses by horse — packages aren&apos;t included there because a package isn&apos;t tied to a single horse.</p>
                </>
              }
            />
          </h1>
          <p className="text-sm text-ink-500 mt-2">{data.label}</p>
        </div>
        <input
          type="month"
          value={data.yearMonth}
          onChange={(e) => changePeriod(e.target.value)}
          className="
            rounded-xl border border-ink-200 bg-white text-sm text-ink-900
            px-3 h-10 max-w-[200px]
            focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
          "
        />
      </div>

      {/* Summary hero — net profit + revenue/expenses split -- */}
      <div className="relative overflow-hidden rounded-3xl p-6 text-brand-50 shadow-lift bg-gradient-to-br from-brand-700 to-brand-900">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-saddle-200">
          Net {data.net >= 0 ? "profit" : "loss"} · {data.label}
        </div>
        <div className="font-mono font-semibold text-[46px] md:text-[52px] leading-none tracking-tight mt-2 tabular-nums">
          {FMT_EUR.format(data.net)}
        </div>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-100 mt-3 bg-white/10 px-3 py-1.5 rounded-full">
          {data.net >= 0 ? "In profit this month" : "Running at a loss this month"}
        </span>
        <div className="flex gap-3 mt-5">
          <div className="flex-1 bg-white/[0.07] border border-white/10 rounded-2xl p-3.5">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-brand-50/60 flex items-center gap-1.5">
              <span className="w-[7px] h-[7px] rounded-full bg-brand-300" />Revenue
            </div>
            <div className="font-mono font-semibold text-[22px] mt-1.5 text-brand-200 tabular-nums">
              {FMT_EUR.format(data.revenue.total)}
            </div>
          </div>
          <div className="flex-1 bg-white/[0.07] border border-white/10 rounded-2xl p-3.5">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-brand-50/60 flex items-center gap-1.5">
              <span className="w-[7px] h-[7px] rounded-full bg-saddle-400" />Expenses
            </div>
            <div className="font-mono font-semibold text-[22px] mt-1.5 text-saddle-300 tabular-nums">
              {FMT_EUR.format(data.expenses.total)}
            </div>
          </div>
        </div>
      </div>

      {/* Revenue breakdown ----------------------------------- */}
      <Panel
        title="Revenue"
        subtitle="By source — packages and boarding paid up front; lessons paid per session."
      >
        <CategoryRows
          rows={[
            { key: "lessons",       label: "One-off lessons", amount: data.revenue.byCategory.lessons },
            { key: "packages",      label: "Packages",        amount: data.revenue.byCategory.packages },
            { key: "boarding",      label: "Boarding",        amount: data.revenue.byCategory.boarding },
            { key: "uncategorized", label: "Uncategorised",   amount: data.revenue.byCategory.uncategorized },
          ].filter((r) => r.amount > 0)}
          total={data.revenue.total}
        />

        {data.revenue.byService.length > 0 && (
          <>
            <SubHeader>By service</SubHeader>
            <ul className="flex flex-col">
              {data.revenue.byService.map((r) => (
                <ItemRow
                  key={r.serviceId ?? "__none__"}
                  primary={r.serviceName}
                  secondary={`${r.lessonCount} ${r.lessonCount === 1 ? "lesson" : "lessons"}`}
                  amount={r.amount}
                  total={data.revenue.total}
                />
              ))}
            </ul>
          </>
        )}

        {data.packageCoveredLessons > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50/60 px-3 py-2.5">
            <span className="text-emerald-600 text-sm leading-none mt-0.5">✓</span>
            <p className="text-[11.5px] text-emerald-800 leading-relaxed">
              <strong>{data.packageCoveredLessons}</strong> {data.packageCoveredLessons === 1 ? "lesson this month was" : "lessons this month were"} covered by a subscription package.
              {" "}They add <strong>€0</strong> here — that money was already counted in the month the package was paid, so it isn&apos;t double-counted.
            </p>
          </div>
        )}
      </Panel>

      {/* Expenses breakdown ---------------------------------- */}
      <Panel
        title="Expenses"
        subtitle="What the stable spent — by category and by horse."
      >
        {data.expenses.total === 0 ? (
          <EmptyState
            title="No expenses logged"
            body="Add expenses on the Expenses page to start seeing the picture here."
            href="/dashboard/expenses"
          />
        ) : (
          <>
            <CategoryRows
              rows={data.expenses.byCategory.map((c) => ({
                key:    c.category,
                label:  EXPENSE_LABEL[c.category] ?? c.category,
                amount: c.amount,
                meta:   `${c.count} ${c.count === 1 ? "entry" : "entries"}`,
              }))}
              total={data.expenses.total}
            />

            {data.expenses.byHorse.length > 0 && (
              <>
                <SubHeader>By horse</SubHeader>
                <ul className="flex flex-col">
                  {data.expenses.byHorse.map((h) => (
                    <ItemRow
                      key={h.horseId}
                      primary={h.horseName}
                      secondary={`${h.count} ${h.count === 1 ? "entry" : "entries"}`}
                      amount={h.amount}
                      total={data.expenses.total}
                      href={`/dashboard/horses/${h.horseId}`}
                    />
                  ))}
                </ul>
                {data.expenses.unattributed > 0 && (
                  <div className="px-4 py-2 text-[12px] text-ink-500 border-t border-ink-100">
                    Unattributed (no horse): {FMT_EUR.format(data.expenses.unattributed)}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </Panel>

      {/* Per-horse profitability ----------------------------- */}
      {data.perHorse.length > 0 && (
        <Panel
          title="Per-horse"
          subtitle="Revenue earned (lessons + boarding) minus expenses tagged to each horse. Package revenue is excluded — it isn't tied to a single horse."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-ink-500 border-b border-ink-100">
                  <th className="px-4 py-2 font-semibold">Horse</th>
                  <th className="px-4 py-2 font-semibold text-right">Revenue</th>
                  <th className="px-4 py-2 font-semibold text-right">Expenses</th>
                  <th className="px-4 py-2 font-semibold text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {data.perHorse.map((h) => (
                  <tr key={h.horseId} className="border-b border-ink-100 last:border-0">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/dashboard/horses/${h.horseId}`}
                        className="font-medium text-navy-900 hover:text-brand-700"
                      >
                        {h.horseName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">
                      {FMT_EUR.format(h.revenue)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-rose-700">
                      {FMT_EUR.format(h.expenses)}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right tabular-nums font-semibold ${
                        h.net >= 0 ? "text-emerald-800" : "text-rose-800"
                      }`}
                    >
                      {FMT_EUR.format(h.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

// ---------- panels & rows ----------------------------------

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl shadow-soft overflow-hidden">
      <div className="px-5 py-4 border-b border-ink-100">
        <h2 className="text-sm font-semibold text-navy-900">{title}</h2>
        {subtitle && (
          <p className="text-[11.5px] text-ink-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

function SubHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 pt-4 pb-2 text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-500 border-t border-ink-100">
      {children}
    </div>
  );
}

function CategoryRows({
  rows,
  total,
}: {
  rows: { key: string; label: string; amount: number; meta?: string }[];
  total: number;
}) {
  return (
    <div className="px-5 py-3 flex flex-col">
      {rows.map((r) => {
        const pct = total > 0 ? Math.round((r.amount / total) * 100) : 0;
        const tone = CATEGORY_TONE[r.key] ?? CATEGORY_TONE.other;
        const fill = CATEGORY_FILL[r.key] ?? "bg-ink-400";
        return (
          <div key={r.key} className="flex items-center gap-3 py-3 border-t border-ink-100 first:border-0">
            <span className={`w-9 h-9 rounded-xl shrink-0 inline-flex items-center justify-center text-[13px] font-bold ${tone}`}>
              {r.label[0]?.toUpperCase() ?? "•"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[15px] font-semibold text-ink-900 truncate">{r.label}</span>
                <span className="font-mono font-semibold text-[15px] text-ink-900 tabular-nums shrink-0">
                  {FMT_EUR.format(r.amount)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-sunken mt-2 overflow-hidden">
                <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[11px] text-ink-400 mt-1 tabular-nums">
                {r.meta ? `${r.meta} · ` : ""}{pct}%
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ItemRow({
  primary,
  secondary,
  amount,
  total,
  href,
}: {
  primary: React.ReactNode;
  secondary?: string;
  amount: number;
  total: number;
  href?: string;
}) {
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
  const Inner = (
    <div className="px-4 py-2.5 flex items-center gap-3 hover:bg-ink-100/40 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">{primary}</div>
        {secondary && (
          <p className="text-[11px] text-ink-500 mt-0.5">{secondary}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold tabular-nums text-navy-900">
          {FMT_EUR.format(amount)}
        </p>
        <p className="text-[11px] text-ink-500 tabular-nums">{pct}%</p>
      </div>
    </div>
  );
  return (
    <li className="border-t border-ink-100 first:border-0">
      {href ? <Link href={href}>{Inner}</Link> : Inner}
    </li>
  );
}

function EmptyState({
  title,
  body,
  href,
}: {
  title: string;
  body: string;
  href: string;
}) {
  return (
    <div className="px-5 py-8 text-center">
      <p className="text-sm font-semibold text-navy-900">{title}</p>
      <p className="text-[12.5px] text-ink-500 mt-1">{body}</p>
      <Link
        href={href}
        className="
          mt-3 inline-flex items-center justify-center
          h-10 px-4 rounded-xl text-sm font-medium
          bg-brand-600 text-white shadow-sm hover:bg-brand-700
          transition-colors
        "
      >
        Go to expenses →
      </Link>
    </div>
  );
}

