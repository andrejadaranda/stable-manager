// Screen 6 — Tikslai. Monthly and quarterly targets, and honest pacing.

import { listGoals, GOAL_METRICS } from "@/services/personalDashboard/goals";
import { getStableTimeZone } from "@/services/personalDashboard/common";
import { formatEur, monthBounds, quarterStartKey } from "@/services/personalDashboard/core.pure";
import type { GoalWithProgress, GoalUnit } from "@/services/personalDashboard/goals";
import {
  ScreenHeader,
  Section,
  Panel,
  Chip,
  Empty,
  ProgressBar,
} from "@/components/personal/ui";
import { ActionForm, Field, SelectField, ActionButton } from "@/components/personal/interactive";
import { saveGoalAction, deleteGoalAction } from "@/app/personal/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tikslai" };

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

export default async function GoalsScreen() {
  const now = new Date();
  const tz = await getStableTimeZone();

  const [monthly, quarterly] = await Promise.all([
    listGoals("month", now),
    listGoals("quarter", now),
  ]);

  return (
    <>
      <ScreenHeader eyebrow="Kryptis" title="Tikslai" />

      <GoalGroup
        title="Šis mėnuo"
        hint={monthBounds(now, tz).startKey}
        goals={monthly}
        empty="Šio mėnesio tikslų dar nėra."
      />

      <GoalGroup
        title="Šis ketvirtis"
        hint={quarterStartKey(now, tz)}
        goals={quarterly}
        empty="Šio ketvirčio tikslų dar nėra."
      />

      {/* ---------- Add ---------- */}
      <Section title="Naujas tikslas">
        <Panel>
          <ActionForm action={saveGoalAction} submitLabel="Išsaugoti tikslą">
            <SelectField
              label="Laikotarpis"
              name="period"
              defaultValue="month"
              options={[
                { value: "month", label: "Mėnuo" },
                { value: "quarter", label: "Ketvirtis" },
              ]}
            />
            <SelectField
              label="Ką matuojame"
              name="goalKey"
              options={GOAL_METRICS.map((m) => ({ value: m.key, label: m.label }))}
            />
            <Field
              label="Pavadinimas"
              name="label"
              placeholder="pvz. Pajamos iš treniruočių"
              hint="Kaip nori matyti jį lentoje."
            />
            <Field
              label="Tikslas"
              name="target"
              inputMode="decimal"
              placeholder="3000"
              hint="Skaičius. Eurams — be simbolio."
            />
            <SelectField
              label="Vienetai"
              name="unit"
              defaultValue="eur"
              options={[
                { value: "eur", label: "€" },
                { value: "count", label: "Vienetai" },
                { value: "percent", label: "%" },
              ]}
            />
          </ActionForm>

          <div className="mt-4 border-t border-ink-100 pt-3">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.13em] text-ink-400">
              Ką galiu išmatuoti automatiškai
            </p>
            <ul className="space-y-1">
              {GOAL_METRICS.map((m) => (
                <li key={m.key} className="text-[11.5px] leading-snug text-ink-500">
                  <span className="font-medium text-ink-700">{m.label}</span> — {m.help}
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </Section>
    </>
  );
}

function GoalGroup({
  title,
  hint,
  goals,
  empty,
}: {
  title: string;
  hint: string;
  goals: GoalWithProgress[];
  empty: string;
}) {
  return (
    <Section title={title} hint={hint}>
      {goals.length > 0 ? (
        <div className="space-y-2.5">
          {goals.map((g) => (
            <Panel key={g.id}>
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold text-ink-900">{g.label}</p>
                  <p className="mt-0.5 font-display text-[20px] leading-none tabular-nums text-brand-700">
                    {fmt(g.progress.actual, g.unit)}
                    <span className="ml-1.5 text-[12px] font-normal text-ink-400">
                      / {fmt(g.target, g.unit)}
                    </span>
                  </p>
                </div>
                <Chip tone={STATUS_TONE[g.progress.status]}>
                  {g.measurable ? STATUS_LABEL[g.progress.status] : "rankinis"}
                </Chip>
              </div>

              {g.measurable ? (
                <>
                  <ProgressBar
                    ratio={g.progress.ratio}
                    paceRatio={g.target > 0 ? g.progress.expectedByNow / g.target : 0}
                    tone={STATUS_TONE[g.progress.status]}
                  />
                  <p className="mt-1.5 text-[11px] text-ink-500">
                    Pagal tempą: {fmt(g.progress.expectedByNow, g.unit)} ·{" "}
                    {g.progress.paceDelta >= 0 ? "+" : ""}
                    {fmt(g.progress.paceDelta, g.unit)}
                  </p>
                </>
              ) : (
                <p className="text-[11.5px] leading-snug text-ink-500">
                  Šio rodiklio automatiškai neskaičiuoju — progresą sek pati.
                </p>
              )}

              <div className="mt-2.5 flex justify-end">
                <ActionButton
                  action={async () => deleteGoalAction(g.id)}
                  variant="ghost"
                  pendingLabel="Trinu…"
                >
                  Pašalinti
                </ActionButton>
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <Empty title={empty} detail="Be tikslo skaičiai rodo faktą, bet ne ar jo pakanka." />
      )}
    </Section>
  );
}

function fmt(value: number, unit: GoalUnit): string {
  if (unit === "eur") return formatEur(value);
  if (unit === "percent") return `${Math.round(value)}%`;
  return String(Math.round(value));
}
