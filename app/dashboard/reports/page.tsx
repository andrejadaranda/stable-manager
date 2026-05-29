import Link from "next/link";
import { requirePageRole } from "@/lib/auth/redirects";
import { trainerMonthly, horseUtilization } from "@/services/reports";

export const dynamic = "force-dynamic";

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  await requirePageRole("owner");
  const period = /^\d{4}-\d{2}$/.test(searchParams.period ?? "")
    ? (searchParams.period as string)
    : currentYearMonth();

  const [trainers, horses] = await Promise.all([
    trainerMonthly(period),
    horseUtilization(period),
  ]);

  const totalLessons = trainers.reduce((acc, t) => acc + t.lessons, 0);
  const totalHours   = trainers.reduce((acc, t) => acc + t.hours,   0);
  const totalRevenue = trainers.reduce((acc, t) => acc + t.revenue, 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Reports</h1>
          <p className="text-sm text-ink-500 mt-1">
            Trainer hours + horse utilization for {period}.
          </p>
        </div>
        <form className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-[12px] text-ink-700">
            Period
            <input
              type="month"
              name="period"
              defaultValue={period}
              className="h-9 rounded-lg border border-ink-200 bg-white text-sm px-2"
            />
          </label>
          <button
            type="submit"
            className="h-9 px-3 rounded-lg text-[12px] font-medium bg-brand-600 text-white hover:bg-brand-700"
          >
            Reload
          </button>
        </form>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kpi label="Lessons"  value={String(totalLessons)} />
        <Kpi label="Hours"    value={totalHours.toFixed(1)} />
        <Kpi label="Revenue"  value={`€${totalRevenue.toFixed(2)}`} />
      </div>

      {/* Trainer hours */}
      <section className="bg-white rounded-2xl shadow-soft overflow-hidden">
        <header className="px-5 py-3 border-b border-ink-100/80 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-navy-900">Trainer hours</h2>
          <span className="text-[11px] text-ink-500">Payroll basis</span>
        </header>
        {trainers.length === 0 ? (
          <p className="px-5 py-6 text-[13px] text-ink-500">No lessons for this period.</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="text-[10px] uppercase tracking-[0.12em] text-ink-400">
              <tr><th className="text-left px-5 py-2 font-medium">Trainer</th>
                  <th className="text-right px-5 py-2 font-medium">Lessons</th>
                  <th className="text-right px-5 py-2 font-medium">Hours</th>
                  <th className="text-right px-5 py-2 font-medium">Revenue</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-100/60">
              {trainers.map((t) => (
                <tr key={t.trainer_id ?? "unassigned"}>
                  <td className="px-5 py-2.5 font-medium text-ink-900">{t.trainer_name}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{t.lessons}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums font-semibold">{t.hours.toFixed(2)}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">€{t.revenue.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Horse utilization */}
      <section className="bg-white rounded-2xl shadow-soft overflow-hidden">
        <header className="px-5 py-3 border-b border-ink-100/80 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-navy-900">Horse utilization</h2>
          <span className="text-[11px] text-ink-500">Workload heat</span>
        </header>
        {horses.length === 0 ? (
          <p className="px-5 py-6 text-[13px] text-ink-500">No horses on the roster.</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="text-[10px] uppercase tracking-[0.12em] text-ink-400">
              <tr><th className="text-left px-5 py-2 font-medium">Horse</th>
                  <th className="text-right px-5 py-2 font-medium">Lessons</th>
                  <th className="text-right px-5 py-2 font-medium">Hours</th>
                  <th className="text-right px-5 py-2 font-medium">Daily avg</th>
                  <th className="text-left px-5 py-2 font-medium">Last used</th>
                  <th className="text-right px-5 py-2 font-medium">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-100/60">
              {horses.map((h) => (
                <tr key={h.horse_id}>
                  <td className="px-5 py-2.5">
                    <Link href={`/dashboard/horses/${h.horse_id}`} className="font-medium text-ink-900 hover:underline">{h.horse_name}</Link>
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{h.lessons}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{h.hours.toFixed(2)}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{h.daily_avg.toFixed(2)}</td>
                  <td className="px-5 py-2.5 text-ink-500">
                    {h.last_used ? new Date(h.last_used).toLocaleDateString("en-GB") : "—"}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <StatusBadge status={h.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-soft p-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-ink-500 font-semibold">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink-900 tabular-nums">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: "under" | "ok" | "over" | "idle" }) {
  const map: Record<string, string> = {
    idle:  "bg-rose-50 text-rose-700",
    under: "bg-amber-50 text-amber-800",
    ok:    "bg-emerald-50 text-emerald-700",
    over:  "bg-rose-50 text-rose-700",
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${map[status] ?? ""}`}>
      {status}
    </span>
  );
}
