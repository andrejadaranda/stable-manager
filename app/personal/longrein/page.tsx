// Screen 4 — Longrein health. Is the product alive, and is it growing?
//
// Every card here now has a real source:
//
//   uptime  → dashboard_health_checks, filled by a 5-minute probe of
//             /api/health (.github/workflows/health-check.yml). Uptime is
//             "pings that arrived / pings that should have arrived", so a
//             gap in the series IS the outage — see migration 111.
//   errors  → dashboard_errors, written by the error boundaries and by
//             every degraded read in the dashboard's own services.
//   MRR     → Stripe when it is configured, her own plan prices when it
//             is not. The UI says which, because an estimate presented as
//             a fact is the thing worth avoiding here.
//   FM      → founding_members, a roster she maintains on this screen.
//             The Founding 15 are hand-billed and appear nowhere in the
//             product schema, so there is nothing to derive them from.

import Link from "next/link";
import { getLongreinHealth } from "@/services/personalDashboard/longrein";
import { listFoundingMembers } from "@/services/personalDashboard/foundingMembers";
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
import { ActionForm, Field } from "@/components/personal/interactive";
import { addFoundingMemberAction } from "@/app/personal/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Longrein" };

export default async function LongreinScreen() {
  const [health, foundingRoster] = await Promise.all([
    getLongreinHealth(),
    listFoundingMembers(),
  ]);

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
            <Metric
              label="MRR"
              value={formatEur(health.mrr)}
              hint={
                health.mrrSource === "stripe"
                  ? "tiesiai iš Stripe — aktyvios prenumeratos"
                  : "įvertis pagal tavo įvestas plano kainas"
              }
              tone="saddle"
            />
          ) : (
            <Empty
              title="MRR dar be šaltinio"
              detail="Stripe neprijungtas (STRIPE_SECRET_KEY nenustatytas), o plano kainų dar neįvedei. Įvesk kainas — arba prijunk Stripe ir skaičius atsiras pats."
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

      {/* ---------- Uptime + errors ---------- */}
      <Section title="Veikimas ir klaidos">
        {health.uptime ? (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <Metric
                label="Veikimas 24 h"
                value={`${health.uptime.uptimePct}%`}
                hint={
                  health.uptime.measuredHours < 23
                    ? `matuota ${health.uptime.measuredHours} val.`
                    : `${health.uptime.received}/${health.uptime.expected} patikrų`
                }
                tone={health.uptime.uptimePct >= 99 ? "positive" : health.uptime.uptimePct >= 95 ? "warning" : "danger"}
              />
              <Metric
                label="Klaidos 24 h"
                value={health.errors24h}
                hint={`${health.errors7d} per 7 d.`}
                tone={health.errors24h === 0 ? "positive" : health.errors24h < 5 ? "warning" : "danger"}
              />
              {health.uptime7d && (
                <Metric
                  label="Veikimas 7 d."
                  value={`${health.uptime7d.uptimePct}%`}
                  hint={`${health.uptime7d.failed} nesėkmingos patikros`}
                  tone={health.uptime7d.uptimePct >= 99 ? "positive" : "warning"}
                />
              )}
              <Metric
                label="Atsakymo laikas"
                value={
                  health.uptime.medianLatencyMs === null
                    ? "—"
                    : `${health.uptime.medianLatencyMs} ms`
                }
                hint="mediana, duomenų bazės užklausa"
                tone="neutral"
              />
            </div>
            <p className="mt-2 px-1 text-[11px] leading-snug text-ink-400">
              Kas 5 min. tikrinu <code>/api/health</code> — jis atlieka tikrą
              užklausą į duomenų bazę. Veikimo procentas = kiek patikrų atėjo iš
              tiek, kiek turėjo ateiti, todėl neatėjusi patikra ir yra gedimo
              įrašas. Klaidos — iš programos klaidų gaudyklių.
            </p>
          </>
        ) : (
          <Empty
            title="Stebėjimas ką tik įjungtas"
            detail="Pirmoji patikra ateis per 5 minutes (GitHub Actions „Uptime probe“). Kai atsiras bent vienas įrašas, čia bus veikimo procentas, atsakymo laikas ir klaidų skaičius."
          />
        )}
      </Section>

      {/* ---------- Founding members ---------- */}
      <Section
        title="Founding Members"
        action={
          <Chip tone={health.foundingMembers.active > 0 ? "positive" : "neutral"}>
            {health.foundingMembers.active}/{health.foundingMembers.total} aktyvūs
          </Chip>
        }
      >
        <div className="mb-2.5 grid grid-cols-3 gap-2.5">
          <Metric label="Iš viso" value={health.foundingMembers.total} tone="brand" />
          <Metric
            label="Naudoja"
            value={health.foundingMembers.active}
            hint={`${health.foundingMembers.committed} pažadėjo`}
            tone="positive"
          />
          <Metric
            label="Būsimas MRR"
            value={formatEur(health.foundingMembers.monthlyEur)}
            hint="po nemokamų metų"
            tone="saddle"
          />
        </div>

        {foundingRoster.length > 0 ? (
          <Panel padded={false}>
            {foundingRoster.map((m) => (
              <Row key={m.id}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-ink-900">
                    {m.fullName}
                  </span>
                  {m.email && (
                    <span className="block truncate text-[11px] text-ink-400">{m.email}</span>
                  )}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-ink-500">
                  {formatEur(m.monthlyEur)}
                </span>
                <Chip
                  tone={
                    m.status === "active" ? "positive" : m.status === "churned" ? "danger" : "warning"
                  }
                >
                  {m.status === "active" ? "naudoja" : m.status === "churned" ? "išėjo" : "pažadėjo"}
                </Chip>
              </Row>
            ))}
          </Panel>
        ) : (
          <Empty
            title={
              health.foundingMembers.tableExists
                ? "Sąrašas tuščias"
                : "Lentelė dar nesukurta"
            }
            detail={
              health.foundingMembers.tableExists
                ? "Founding Members apmokestinami rankiniu būdu, tad produkto duomenų bazėje jų nėra iš ko išvesti. Suvesk juos čia — skaičius bus tikras."
                : "Pritaikyk migraciją 111_personal_dashboard_ops.sql — tada šis sąrašas pradės veikti."
            }
          />
        )}

        <Panel className="mt-2.5">
          <p className="mb-3 text-[11.5px] leading-relaxed text-ink-500">
            Pridėk žmogų, kai jis sutinka. Kai jis susikuria arklidę — pažymėk
            „naudoja“.
          </p>
          <ActionForm action={addFoundingMemberAction} submitLabel="Pridėti">
            <Field label="Vardas" name="fullName" placeholder="Vardenė Pavardenė" />
            <Field label="El. paštas" name="email" placeholder="vardas@pastas.lt" />
            <Field
              label="Mėnesio kaina (€)"
              name="monthlyEur"
              inputMode="decimal"
              placeholder="25"
              hint="Founding Member kaina užrakinta visam laikui — numatytoji 25 €."
            />
            <Field label="Pastaba" name="notes" placeholder="pvz. iš Kauno klubo" />
          </ActionForm>
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
