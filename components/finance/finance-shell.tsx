"use client";

// Finance dashboard shell — month picker + KPI strip + breakdown
// panels. Server fetches all numbers in one call; this component is
// just presentation + month navigation.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { MonthFinancials } from "@/services/finance";
import { HelpHint } from "@/components/ui";

const FMT_EUR = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "EUR",
});

const EXPENSE_LABEL: Record<string, string> = {
  feed:        "Feed",
  vet:         "Vet",
  farrier:     "Farrier",
  maintenance: "Maintenance",
  staff:       "Staff",
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
        <div className="min-w-0">
          <Link
            href="/dashboard"
            className="text-[12px] text-ink-500 hover:text-ink-900 inline-flex items-center gap-1"
          >
            ← Dashboard
          </Link>
          <h1 className="font-display text-3xl md:text-4xl text-navy-900 leading-none mt-2 inline-flex items-center gap-2">
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

      {/* Headline KPIs --------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard
          label="Revenue"
          value={FMT_EUR.format(data.revenue.total)}
          sub="Money in"
          tone="ok"
        />
        <KpiCard
          label="Expenses"
          value={FMT_EUR.format(data.expenses.total)}
          sub="Money out"
          tone="warn"
        />
        <KpiCard
          label="Net"
          value={FMT_EUR.format(data.net)}
          sub={data.net >= 0 ? "Profit" : "Loss"}
          tone={data.net >= 0 ? "ok" : "danger"}
          big
        />
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
            { key: "uncategorized", label: "Other",           amount: data.revenue.byCategory.uncategorized },
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
    <ul className="flex flex-col">
      {rows.map((r) => (
        <ItemRow
          key={r.key}
          primary={
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${CATEGORY_TONE[r.key] ?? CATEGORY_TONE.other}`}>
              {r.label}
            </span>
          }
          secondary={r.meta}
          amount={r.amount}
          total={total}
        />
      ))}
    </ul>
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

function KpiCard({
  label,
  value,
  sub,
  tone,
  big,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "ok" | "warn" | "danger";
  big?: boolean;
}) {
  const valueClass =
    tone === "warn"   ? "text-amber-700"   :
    tone === "ok"     ? "text-emerald-800" :
    tone === "danger" ? "text-rose-800"    :
                        "text-navy-900";
  return (
    <div className={`bg-white rounded-2xl shadow-soft p-5 ${big ? "ring-1 ring-emerald-200" : ""}`}>
      <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-500">
        {label}
      </p>
      <p className={`font-display ${big ? "text-4xl" : "text-3xl"} tabular-nums mt-1.5 ${valueClass}`}>
        {value}
      </p>
      <p className="text-[11.5px] text-ink-500 mt-1">{sub}</p>
    </div>
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

