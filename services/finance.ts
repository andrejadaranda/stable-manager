// Finance service — month-level revenue + expense aggregation for the
// owner-only finance dashboard.
//
// Two queries fan out in parallel:
//   1. payments for the month (with joins to lesson + service + horse,
//      and boarding-charge → horse for the per-horse view)
//   2. expenses for the month (with horse joins)
//
// Everything else is in-process: bucketing by category, by service, by
// horse, computing net per horse. For typical stable size (50–500
// payments + ~100 expenses per month) this is sub-100ms.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";
import type { ExpenseCategory } from "@/services/expenses";

// ---------- types -------------------------------------------------

export type RevenueByCategory = {
  lessons: number;
  packages: number;
  boarding: number;
  /** Payments not linked to any of the above (rare — one-off cash). */
  uncategorized: number;
};

export type RevenueByService = {
  serviceId: string | null;
  serviceName: string;
  amount: number;
  /** Distinct lessons (payments) under this service. */
  lessonCount: number;
};

export type ExpenseByCategory = {
  category: ExpenseCategory;
  amount: number;
  count: number;
};

export type ExpenseByHorse = {
  horseId: string;
  horseName: string;
  amount: number;
  count: number;
};

export type PerHorseFinancial = {
  horseId: string;
  horseName: string;
  /** Lesson + boarding revenue tied to this horse. Excludes packages
   *  (those attribute to the client, not a single horse). */
  revenue: number;
  /** Expenses tagged with this horse. */
  expenses: number;
  net: number;
};

export type MonthFinancials = {
  yearMonth: string;     // "2026-04"
  label: string;         // "April 2026"
  /** Inclusive ISO datetime range — exposed for any caller that wants
   *  to drill in further. */
  periodStart: string;
  periodEnd: string;

  revenue: {
    total: number;
    byCategory: RevenueByCategory;
    byService: RevenueByService[];
  };

  expenses: {
    total: number;
    byCategory: ExpenseByCategory[];
    byHorse: ExpenseByHorse[];
    unattributed: number;
  };

  perHorse: PerHorseFinancial[];

  net: number;
};

// ---------- public API --------------------------------------------

export async function getMonthFinancials(yearMonth: string): Promise<MonthFinancials> {
  const session = await getSession();
  requireRole(session, "owner");
  void session;

  const [year, month] = yearMonth.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) {
    throw new Error("INVALID_PERIOD");
  }

  const periodStart = new Date(year, month - 1, 1).toISOString();
  const periodEnd   = new Date(year, month,     1).toISOString();
  const incurredFrom = `${year}-${pad(month)}-01`;
  const incurredTo =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${pad(month + 1)}-01`;

  const supabase = createSupabaseServerClient();

  // Fan out the two big queries in parallel.
  const [paymentsRes, expensesRes] = await Promise.all([
    supabase
      .from("payments")
      .select(
        `
        id, amount, lesson_id, package_id, boarding_charge_id,
        lesson:lessons(id, horse_id, service_id,
          service:services(id, name),
          horse:horses(id, name)
        ),
        boarding_charge:horse_boarding_charges(id, horse_id,
          horse:horses(id, name)
        )
        `,
      )
      .gte("paid_at", periodStart)
      .lt("paid_at", periodEnd),
    supabase
      .from("expenses")
      .select(
        `
        id, category, amount, horse_id,
        horse:horses(id, name)
        `,
      )
      .gte("incurred_on", incurredFrom)
      .lt("incurred_on", incurredTo),
  ]);

  if (paymentsRes.error) throw paymentsRes.error;
  if (expensesRes.error) throw expensesRes.error;

  // ---------- Revenue --------------------------------------
  type PaymentRow = {
    id: string;
    amount: number;
    lesson_id: string | null;
    package_id: string | null;
    boarding_charge_id: string | null;
    lesson: {
      id: string;
      horse_id: string;
      service_id: string | null;
      service: { id: string; name: string } | null;
      horse: { id: string; name: string } | null;
    } | null;
    boarding_charge: {
      id: string;
      horse_id: string;
      horse: { id: string; name: string } | null;
    } | null;
  };
  const payments = (paymentsRes.data ?? []) as unknown as PaymentRow[];

  const byCategory: RevenueByCategory = {
    lessons: 0, packages: 0, boarding: 0, uncategorized: 0,
  };
  const serviceMap = new Map<string, RevenueByService>();
  const horseRevenueMap = new Map<string, { name: string; amount: number }>();

  for (const p of payments) {
    const a = Number(p.amount ?? 0);

    // Bucket by category. Priority: package > boarding > lesson > none.
    // Same payment usually has only one of these set, but if a future
    // bug links multiple we still get a deterministic count.
    if (p.package_id) {
      byCategory.packages += a;
    } else if (p.boarding_charge_id) {
      byCategory.boarding += a;
      const h = p.boarding_charge?.horse;
      if (h) {
        const cur = horseRevenueMap.get(h.id) ?? { name: h.name, amount: 0 };
        cur.amount += a;
        horseRevenueMap.set(h.id, cur);
      }
    } else if (p.lesson_id) {
      byCategory.lessons += a;
      const h = p.lesson?.horse;
      if (h) {
        const cur = horseRevenueMap.get(h.id) ?? { name: h.name, amount: 0 };
        cur.amount += a;
        horseRevenueMap.set(h.id, cur);
      }
      // Service breakdown.
      const svcKey = p.lesson?.service?.id ?? "__none__";
      const svcName = p.lesson?.service?.name ?? "Other / no service";
      const cur =
        serviceMap.get(svcKey) ??
        ({
          serviceId: p.lesson?.service?.id ?? null,
          serviceName: svcName,
          amount: 0,
          lessonCount: 0,
        } as RevenueByService);
      cur.amount += a;
      cur.lessonCount += 1;
      serviceMap.set(svcKey, cur);
    } else {
      byCategory.uncategorized += a;
    }
  }

  const totalRevenue =
    byCategory.lessons + byCategory.packages + byCategory.boarding + byCategory.uncategorized;

  const byService = Array.from(serviceMap.values()).sort(
    (a, b) => b.amount - a.amount,
  );

  // ---------- Expenses -------------------------------------
  type ExpenseRow = {
    id: string;
    category: ExpenseCategory;
    amount: number;
    horse_id: string | null;
    horse: { id: string; name: string } | null;
  };
  const expenses = (expensesRes.data ?? []) as unknown as ExpenseRow[];

  const expByCat = new Map<ExpenseCategory, ExpenseByCategory>();
  const expByHorse = new Map<string, ExpenseByHorse>();
  let unattributed = 0;

  for (const e of expenses) {
    const a = Number(e.amount ?? 0);

    const cur = expByCat.get(e.category) ?? {
      category: e.category, amount: 0, count: 0,
    };
    cur.amount += a;
    cur.count += 1;
    expByCat.set(e.category, cur);

    if (e.horse) {
      const hcur = expByHorse.get(e.horse.id) ?? {
        horseId: e.horse.id, horseName: e.horse.name, amount: 0, count: 0,
      };
      hcur.amount += a;
      hcur.count += 1;
      expByHorse.set(e.horse.id, hcur);
    } else {
      unattributed += a;
    }
  }

  const totalExpenses = expenses.reduce(
    (acc, e) => acc + Number(e.amount ?? 0), 0,
  );

  // ---------- Per-horse roll-up ---------------------------
  const horseIds = new Set<string>([
    ...horseRevenueMap.keys(),
    ...expByHorse.keys(),
  ]);
  const perHorse: PerHorseFinancial[] = [];
  for (const id of horseIds) {
    const r = horseRevenueMap.get(id);
    const x = expByHorse.get(id);
    const name = r?.name ?? x?.horseName ?? "—";
    const rev = r?.amount ?? 0;
    const exp = x?.amount ?? 0;
    perHorse.push({
      horseId: id,
      horseName: name,
      revenue: rev,
      expenses: exp,
      net: rev - exp,
    });
  }
  perHorse.sort((a, b) => b.net - a.net);

  return {
    yearMonth,
    label: new Date(year, month - 1, 1).toLocaleDateString(undefined, {
      month: "long", year: "numeric",
    }),
    periodStart,
    periodEnd,

    revenue: {
      total: totalRevenue,
      byCategory,
      byService,
    },

    expenses: {
      total: totalExpenses,
      byCategory: Array.from(expByCat.values()).sort((a, b) => b.amount - a.amount),
      byHorse:    Array.from(expByHorse.values()).sort((a, b) => b.amount - a.amount),
      unattributed,
    },

    perHorse,

    net: totalRevenue - totalExpenses,
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
