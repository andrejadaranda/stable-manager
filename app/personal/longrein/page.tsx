// Screen 4 — Longrein health. Is the product alive, and is it growing?
//
// Honesty note that shows up in the UI as well as here: uptime and error
// rate have no source in this codebase (no Sentry, no APM, no error
// table). Rather than render a comforting 99.9%, that card says plainly
// that it isn't connected and what to connect.

import Link from "next/link";
import { getLongreinHealth } from "@/services/personalDashboard/longrein";
import { formatEur } from "@/services/personalDashboard/core.pure";
import {
  ScreenHeader,
  Section,
  Panel,
  Metric,
  Chip,
  Row,
  Empty,
} from "@/components/personal/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Longrein" };

export default async function LongreinScreen() {
  const health = await getLongreinHealth();

  const stableGrowth = delta(health.stables.newLast30, health.stables.newPrev30);
  const waitlistGrowth = delta(health.waitlist.last7, health.waitlist.prev7);

  return (
    <>
      <ScreenHeader eyebrow="Produktas" title="Longrein" />

      {/* ---------- Growth ---------- */}
      <Section title="Augimas">
        <div className="grid grid-cols-2 gap-2.5">
          <Metric
            label="Arklidės"
            value={health.stables.total}
            hint={`+${health.stables.newLast30} per 30 d.`}
            tone="brand"
          />
          <Metric
            label="30 d. tempas"
            value={stableGrowth.label}
            hint={`buvo ${health.stables.newPrev30}`}
            tone={stableGrowth.tone}
          />
          <Metric
            label="Vartotojai"
            value={health.users.total}
            hint={`${health.users.activeLast7} aktyvūs per 7 d.`}
            tone="neutral"
          />
          <Metric
            label="Laukiantieji"
            value={health.waitlist.total}
            hint={`+${health.waitlist.last7} per 7 d. (${waitlistGrowth.label})`}
            tone={waitlistGrowth.tone}
          />
        </div>
        <p className="mt-2 px-1 text-[11px] leading-snug text-ink-400">
          „Aktyvūs“ = žmonės, kurie per 7 dienas atliko bent vieną veiksmą,
          paliekantį pėdsaką audito žurnale. Tai artimiausias turimas
          aktyvumo signalas — atskiros analitikos lentelės nėra.
        </p>
      </Section>

      {/* ---------- Revenue ---------- */}
      <Section title="Prenumeratos">
        <Panel padded={false}>
          <Row>
            <span className="min-w-0 flex-1 text-[13px] text-ink-800">Aktyvios</span>
            <span className="font-display text-[15px] tabular-nums text-emerald-700">
              {health.subscriptions.active}
            </span>
          </Row>
          <Row>
            <span className="min-w-0 flex-1 text-[13px] text-ink-800">Bandomasis laikotarpis</span>
            <span className="font-display text-[15px] tabular-nums text-brand-700">
              {health.subscriptions.trialing}
            </span>
          </Row>
          <Row>
            <span className="min-w-0 flex-1 text-[13px] text-ink-800">Vėluoja mokėjimas</span>
            <span className="font-display text-[15px] tabular-nums text-amber-700">
              {health.subscriptions.past_due}
            </span>
          </Row>
          <Row>
            <span className="min-w-0 flex-1 text-[13px] text-ink-800">Atšauktos</span>
            <span className="font-display text-[15px] tabular-nums text-ink-500">
              {health.subscriptions.cancelled}
            </span>
          </Row>
        </Panel>

        <div className="mt-2.5">
          {health.mrr !== null ? (
            <Metric label="MRR" value={formatEur(health.mrr)} hint="pagal tavo įvestas plano kainas" tone="saddle" />
          ) : (
            <Empty
              title="MRR neskaičiuojamas"
              detail="Kodo bazėje nėra patikimo plano→kainos žemėlapio: Stripe kainos gyvena aplinkos kintamuosiuose, Founding Members apmokestinami rankiniu būdu, o FREE_MODE šiuo metu įjungtas. Įvesk planų kainas pati — tada čia atsiras tikras skaičius."
              action={
                <Link
                  href="/personal/nustatymai"
                  className="inline-block rounded-full border border-ink-200 bg-white px-4 py-2 text-[12.5px] font-semibold text-ink-700"
                >
                  Įvesti kainas
                </Link>
              }
            />
          )}
        </div>
      </Section>

      {/* ---------- Uptime ---------- */}
      <Section title="Veikimas ir klaidos">
        {health.uptime ? (
          <div className="grid grid-cols-2 gap-2.5">
            <Metric label="Veikimo laikas" value={`${health.uptime.uptimePct}%`} hint={health.uptime.window} tone="positive" />
            <Metric label="Klaidų dalis" value={`${health.uptime.errorRate}%`} tone="neutral" />
          </div>
        ) : (
          <Empty
            title="Stebėjimas neprijungtas"
            detail="Šioje kodo bazėje nėra nei Sentry, nei APM, nei klaidų lentelės — todėl čia nerodau jokio skaičiaus. Prijungus Sentry (arba UptimeRobot) ir įvedus API raktą nustatymuose, kortelė užsipildys."
            action={
              <Link
                href="/personal/nustatymai"
                className="inline-block rounded-full border border-ink-200 bg-white px-4 py-2 text-[12.5px] font-semibold text-ink-700"
              >
                Prijungti stebėjimą
              </Link>
            }
          />
        )}
      </Section>

      {/* ---------- Founding members ---------- */}
      <Section title="Founding Members">
        <Panel>
          <p className="text-[12.5px] leading-relaxed text-ink-600">
            Atskiros „founding member“ lentelės duomenų bazėje nėra, tad
            atskiro skaitiklio čia nekuriu. Jei nori sekti FM progresą,
            susikurk tikslą <Chip tone="brand">Naujos Longrein arklidės</Chip> skiltyje
            „Tikslai“ — jis skaičiuoja realias naujas arklides ir rodo progresą juostoje.
          </p>
          <Link
            href="/personal/tikslai"
            className="mt-3 inline-block rounded-full border border-ink-200 bg-white px-4 py-2 text-[12.5px] font-semibold text-ink-700"
          >
            Į tikslus
          </Link>
        </Panel>
      </Section>
    </>
  );
}

function delta(current: number, previous: number): { label: string; tone: "positive" | "danger" | "neutral" } {
  if (previous === 0) {
    return current > 0
      ? { label: "naujas", tone: "positive" }
      : { label: "—", tone: "neutral" };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 5) return { label: `+${pct}%`, tone: "positive" };
  if (pct < -5) return { label: `${pct}%`, tone: "danger" };
  return { label: `${pct >= 0 ? "+" : ""}${pct}%`, tone: "neutral" };
}
