// "Why this month?" card — a plain read on what moved income vs last month,
// and specifically who stopped riding (the usual reason income dips). Server
// component, presentational only.

import Link from "next/link";
import type { MonthInsight as Insight } from "@/services/finance";

const EUR = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function MonthInsight({ insight }: { insight: Insight }) {
  const up = insight.revenueDelta >= 0;
  const deltaAbs = Math.abs(insight.revenueDelta);
  const lessonsDelta = insight.lessonsDelivered - insight.prevLessonsDelivered;
  const ridersDelta = insight.activeRiders - insight.prevActiveRiders;

  return (
    <section className="bg-white border border-ink-100 rounded-2xl shadow-soft p-5">
      <h2 className="font-serif font-semibold text-[18px] text-ink-900 mb-1">Kodėl šį mėnesį tiek?</h2>
      <p className="text-[12.5px] text-ink-500 mb-4">Palyginimas su praėjusiu mėnesiu — kas pasikeitė.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat
          label="Pajamos vs praeitas mėn."
          value={`${up ? "+" : "−"}${EUR.format(deltaAbs)}`}
          sub={`${EUR.format(insight.revenue)} vs ${EUR.format(insight.prevRevenue)}`}
          tone={up ? "ok" : "warn"}
        />
        <Stat
          label="Pravestos pamokos"
          value={`${insight.lessonsDelivered}`}
          sub={`${lessonsDelta >= 0 ? "+" : ""}${lessonsDelta} vs praeitas (${insight.prevLessonsDelivered})`}
          tone={lessonsDelta >= 0 ? "ok" : "warn"}
        />
        <Stat
          label="Jojusių klientų"
          value={`${insight.activeRiders}`}
          sub={`${ridersDelta >= 0 ? "+" : ""}${ridersDelta} vs praeitas (${insight.prevActiveRiders})`}
          tone={ridersDelta >= 0 ? "ok" : "warn"}
        />
      </div>

      {insight.quietClients.length > 0 ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          <p className="text-[12.5px] font-semibold text-amber-900">
            Nebejojo šį mėnesį ({insight.quietClients.length}) — jojo praeitą:
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {insight.quietClients.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/clients/${c.id}`}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium bg-white text-amber-900 border border-amber-200 hover:border-amber-400"
              >
                {c.name}
              </Link>
            ))}
          </div>
          <p className="text-[11px] text-amber-800 mt-2">
            Dažniausia mažesnių pajamų priežastis — rečiau jojantys klientai. Spustelk vardą, kad parašytum ar įvestum pamoką.
          </p>
        </div>
      ) : (
        <p className="mt-4 text-[12.5px] text-ink-500">Visi praeito mėnesio klientai jojo ir šį mėnesį. 👍</p>
      )}
    </section>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "ok" | "warn" }) {
  return (
    <div className="rounded-xl bg-ink-50 p-3">
      <div className={`text-[20px] font-bold leading-none ${tone === "ok" ? "text-brand-700" : "text-alert-600"}`}>{value}</div>
      <div className="text-[12.5px] font-semibold text-ink-700 mt-1.5">{label}</div>
      <div className="text-[11px] text-ink-400 mt-0.5">{sub}</div>
    </div>
  );
}
