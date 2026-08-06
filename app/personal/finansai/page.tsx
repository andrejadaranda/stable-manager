// Screen 3 — Finansai. What came in, what's owed, where the month lands.

import Link from "next/link";
import { getFinanceSnapshot } from "@/services/personalDashboard/finance";
import { getStableTimeZone } from "@/services/personalDashboard/common";
import { formatEur, monthBounds } from "@/services/personalDashboard/core.pure";
import {
  ScreenHeader,
  Section,
  Panel,
  Metric,
  Chip,
  Row,
  Empty,
  ProgressBar,
} from "@/components/personal/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Finansai" };

const STATUS_LABEL = {
  ahead: "pirmauji",
  on_track: "pagal planą",
  behind: "atsilieki",
  no_target: "—",
} as const;

const STATUS_TONE = {
  ahead: "positive",
  on_track: "brand",
  behind: "danger",
  no_target: "neutral",
} as const;

export default async function FinanceScreen() {
  const now = new Date();
  const tz = await getStableTimeZone();
  const snapshot = await getFinanceSnapshot(now);
  const { dayOfMonth, daysInMonth } = monthBounds(now, tz);
  const f = snapshot.forecast;

  return (
    <>
      <ScreenHeader eyebrow={monthName(now, tz)} title="Finansai" />

      {/* ---------- Goal ---------- */}
      <Section title="Mėnesio tikslas">
        {snapshot.goal ? (
          <Panel>
            <div className="mb-2 flex items-end justify-between gap-3">
              <div>
                <p className="font-display text-[28px] leading-none tracking-tightest tabular-nums text-brand-700">
                  {formatEur(snapshot.goal.actual)}
                </p>
                <p className="mt-1 text-[11.5px] text-ink-500">
                  iš {formatEur(snapshot.goal.target)} · {Math.round(snapshot.goal.ratio * 100)}%
                </p>
              </div>
              <Chip tone={STATUS_TONE[snapshot.goal.status]}>
                {STATUS_LABEL[snapshot.goal.status]}
              </Chip>
            </div>
            <ProgressBar
              ratio={snapshot.goal.ratio}
              paceRatio={snapshot.goal.target > 0 ? snapshot.goal.expectedByNow / snapshot.goal.target : 0}
              tone={STATUS_TONE[snapshot.goal.status]}
            />
            <p className="mt-2 text-[11.5px] leading-snug text-ink-500">
              {dayOfMonth} d. iš {daysInMonth}. Pagal tempą turėtum turėti{" "}
              {formatEur(snapshot.goal.expectedByNow)} —{" "}
              {snapshot.goal.paceDelta >= 0 ? "esi priekyje " : "atsilieki "}
              {formatEur(Math.abs(snapshot.goal.paceDelta))}.
            </p>
          </Panel>
        ) : (
          <Empty
            title="Šio mėnesio tikslas nenustatytas"
            detail="Be tikslo galiu parodyti tik faktą, bet ne ar jo pakanka."
            action={
              <Link
                href="/personal/tikslai"
                className="inline-block rounded-full bg-brand-600 px-4 py-2 text-[12.5px] font-semibold text-white"
              >
                Nustatyti tikslą
              </Link>
            }
          />
        )}
      </Section>

      {/* ---------- The month in four numbers ---------- */}
      <Section title="Šis mėnuo">
        <div className="grid grid-cols-2 gap-2.5">
          <Metric label="Gauta" value={formatEur(f.earnedToDate)} hint="realiai apmokėta" tone="positive" />
          <Metric
            label="Laukia"
            value={formatEur(f.outstanding)}
            hint="įvyko, neapmokėta"
            tone={f.outstanding > 0 ? "warning" : "neutral"}
          />
          <Metric label="Užsakyta" value={formatEur(f.booked)} hint="dar įvyks" tone="brand" />
          <Metric label="Treniruočių" value={snapshot.lessonsDelivered} hint="įvykusių" tone="neutral" />
        </div>
      </Section>

      {/* ---------- Forecast ---------- */}
      <Section title="Prognozė mėnesio pabaigai">
        <Panel>
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.13em] text-ink-400">Pagal kalendorių</p>
              <p className="font-display text-[24px] leading-tight tabular-nums text-brand-700">
                {formatEur(f.bookedForecast)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[0.13em] text-ink-400">Pagal tempą</p>
              <p className="font-display text-[24px] leading-tight tabular-nums text-saddle-600">
                {formatEur(f.paceForecast)}
              </p>
            </div>
          </div>
          {/* Two numbers, not one — the honest floor and the optimistic read.
              She's the one who knows which half of the month is busier. */}
          <p className="mt-2.5 border-t border-ink-100 pt-2.5 text-[11.5px] leading-relaxed text-ink-500">
            Kairėje — kas jau realiai kalendoriuje. Dešinėje — jei likusi mėnesio
            dalis bus tokia pat kaip pradžia. Tiesa paprastai per vidurį.
          </p>
        </Panel>
      </Section>

      {/* ---------- Top clients ---------- */}
      <Section title="Daugiausia pajamų">
        {snapshot.topClients.length > 0 ? (
          <Panel padded={false}>
            {snapshot.topClients.map((c, i) => (
              <Row key={c.clientId}>
                <span className="w-4 shrink-0 font-display text-[13px] text-ink-300">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink-900">
                  {c.clientName}
                </span>
                {c.lessons > 0 && (
                  <span className="shrink-0 text-[11px] text-ink-400">{c.lessons} tr.</span>
                )}
                <span className="shrink-0 font-display text-[14px] tabular-nums text-brand-700">
                  {formatEur(c.amount)}
                </span>
              </Row>
            ))}
          </Panel>
        ) : (
          <Empty title="Šį mėnesį pajamų dar nėra" />
        )}
      </Section>

      {/* ---------- Unpaid ---------- */}
      <Section
        title="Neapmokėta"
        hint={snapshot.totalOutstanding > 0 ? formatEur(snapshot.totalOutstanding) : undefined}
      >
        {snapshot.unpaid.length > 0 ? (
          <Panel padded={false}>
            {snapshot.unpaid.slice(0, 15).map((u) => (
              <Row key={`${u.itemType}-${u.sourceId}`}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-ink-900">
                    {u.clientName}
                  </span>
                  <span className="block text-[11px] text-ink-400">
                    {u.title} · {u.occursOn}
                  </span>
                </span>
                {u.daysOverdue > 14 && <Chip tone="danger">{u.daysOverdue} d.</Chip>}
                <span className="shrink-0 font-display text-[14px] tabular-nums text-rose-600">
                  {formatEur(u.outstanding)}
                </span>
              </Row>
            ))}
          </Panel>
        ) : (
          <Empty title="Viskas apmokėta" detail="Nė vienos skolos. Retas ir malonus vaizdas." />
        )}
      </Section>
    </>
  );
}

function monthName(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("lt-LT", { timeZone, month: "long", year: "numeric" }).format(now);
}
