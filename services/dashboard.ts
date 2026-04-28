// Dashboard aggregator — single read used by /dashboard home page.
// Owner + employee. Clients have their own portal home (my-lessons).
//
// Composes existing reads:
//  - lessons (this week + today)
//  - horses (active count)
//  - clients (active count + outstanding balance via SQL view if available)
//  - payments (this month sum)
//  - expenses (this month sum, owner-only block tolerated)
//
// Each metric is best-effort: if a query fails or the role can't see it,
// we still return the rest with a null/zero placeholder. UI shows muted
// rather than crash.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";
import { startOfWeek, addDays } from "@/lib/utils/dates";

export type DashboardLesson = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  horse:   { id: string; name: string } | null;
  client:  { id: string; full_name: string } | null;
  trainer: { id: string; full_name: string | null } | null;
};

export type DashboardSummary = {
  todayLessons: DashboardLesson[];
  weekLessonsCount: number;
  weekLessonsCompleted: number;
  activeHorses: number;
  activeClients: number;
  outstandingBalance: number; // EUR (positive = clients owe money to stable)
  monthlyRevenue: number;     // EUR (sum of payments paid_at this calendar month)
  monthlyExpenses: number | null; // owner-only; null = not visible
  monthLabel: string;         // e.g. "April 2026"
  isOwner: boolean;
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  const isOwner = session.role === "owner";

  const supabase = createSupabaseServerClient();
  const now = new Date();

  // ── windows ─────────────────────────────────────────────────────────
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = addDays(todayStart, 1);

  const weekStart = startOfWeek(now);
  const weekEnd   = addDays(weekStart, 7);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const monthLabel = now.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  // ── parallel reads ──────────────────────────────────────────────────
  const todayP = supabase
    .from("lessons")
    .select(`
      id, starts_at, ends_at, status,
      horse:horses(id, name),
      client:clients(id, full_name),
      trainer:profiles(id, full_name)
    `)
    .gte("starts_at", todayStart.toISOString())
    .lt("starts_at", todayEnd.toISOString())
    .order("starts_at", { ascending: true });

  const weekP = supabase
    .from("lessons")
    .select("status", { count: "exact", head: false })
    .gte("starts_at", weekStart.toISOString())
    .lt("starts_at", weekEnd.toISOString());

  const horsesP = supabase
    .from("horses")
    .select("id", { count: "exact", head: true })
    .eq("active", true);

  const clientsP = supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("active", true);

  const monthPaymentsP = supabase
    .from("payments")
    .select("amount")
    .gte("paid_at", monthStart.toISOString())
    .lt("paid_at",  monthEnd.toISOString());

  const monthExpensesP = isOwner
    ? supabase
        .from("expenses")
        .select("amount")
        .gte("incurred_on", monthStart.toISOString().slice(0, 10))
        .lt("incurred_on",  monthEnd.toISOString().slice(0, 10))
    : Promise.resolve({ data: null, error: null });

  // Outstanding balance = sum of positive client_balance() across clients.
  // We do this via a single SQL aggregate to avoid N+1.
  const balanceP = supabase.rpc("clients_total_outstanding").then(
    (r) => r,
    (err) => ({ data: null, error: err }),
  );

  const [
    todayRes,
    weekRes,
    horsesRes,
    clientsRes,
    monthPaymentsRes,
    monthExpensesRes,
    balanceRes,
  ] = await Promise.all([
    todayP, weekP, horsesP, clientsP, monthPaymentsP, monthExpensesP, balanceP,
  ]);

  // ── reduce ──────────────────────────────────────────────────────────
  const todayLessons = (todayRes.data ?? []) as unknown as DashboardLesson[];

  const weekRows = (weekRes.data ?? []) as Array<{ status: DashboardLesson["status"] }>;
  const weekLessonsCount = weekRows.length;
  const weekLessonsCompleted = weekRows.filter(r => r.status === "completed").length;

  const monthlyRevenue = sumAmount(monthPaymentsRes.data);
  const monthlyExpenses = isOwner
    ? sumAmount((monthExpensesRes as { data: unknown }).data)
    : null;

  // Outstanding balance: prefer the SQL aggregate; fall back to 0 if the
  // function isn't installed yet (Phase-1 backwards-compat).
  let outstandingBalance = 0;
  const bd = (balanceRes as { data: unknown }).data;
  if (typeof bd === "number")        outstandingBalance = Number(bd);
  else if (Array.isArray(bd) && bd.length) outstandingBalance = Number((bd[0] as { total?: number }).total ?? 0);
  else if (bd && typeof bd === "object" && "total" in bd) outstandingBalance = Number((bd as { total: number }).total);

  return {
    todayLessons,
    weekLessonsCount,
    weekLessonsCompleted,
    activeHorses: horsesRes.count ?? 0,
    activeClients: clientsRes.count ?? 0,
    outstandingBalance,
    monthlyRevenue,
    monthlyExpenses,
    monthLabel,
    isOwner,
  };
}

function sumAmount(rows: unknown): number {
  if (!Array.isArray(rows)) return 0;
  let total = 0;
  for (const r of rows as Array<{ amount?: number | string }>) {
    const v = Number(r.amount ?? 0);
    if (Number.isFinite(v)) total += v;
  }
  return total;
}
