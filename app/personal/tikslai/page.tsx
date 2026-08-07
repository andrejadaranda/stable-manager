// Screen 6 — Tikslai. Weekly, monthly and quarterly targets, honest
// pacing, and a forecast that says whether the current pace is enough.
//
// The forecast is the part worth defending. A progress bar answers "where
// am I", which is comforting and nearly useless on the 14th of the month.
// "At this pace you finish at €2,000 of €3,000 — you need €100 a day for
// the remaining 10 days" is something she can act on this afternoon. See
// forecastGoal() in core.pure.ts for the guards that keep it honest.

import {
  listGoals,
  listArchivedGoals,
  ensureCurrentGoals,
  GOAL_METRICS,
} from "@/services/personalDashboard/goals";
import { getStableTimeZone } from "@/services/personalDashboard/common";
import {
  formatEur,
  monthBounds,
  quarterStartKey,
  weekBounds,
} from "@/services/personalDashboard/core.pure";
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

  // First visit gets three starter goals; every later period inherits the
  // previous one's, so a monthly target set once does not vanish on the
  // 1st. Deletions stick — see ensureCurrentGoals.
  await ensureCurrentGoals(now);

  const [weekly, monthly, quarterly, archived] = await Promise.all([
    listGoals("week", now),
    listGoals("month", now),
    listGoals("quarter", now),
    listArchivedGoals(20),
  ]);

  return (
    <>
      <ScreenHeader eyebrow="Kryptis" title="Tikslai" />

      <GoalGroup
        title="Ši savaitė"
        hint={`nuo ${weekBounds(now, tz).startKey}`}
        goals={weekly}
        empty="Šios savaitės tikslų dar nėra."
      />

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
                { value: "week", label: "Savaitė" },
                { value: "month", label: "Mėnuo" },
                { value: "quarter", label: "Ketvirtis" },
              ]}
            />
            <SelectField
              label="Sritis"
              name="category"
              defaultValue="tjk"
              options={[
                { value: "tjk", label: "TJK" },
                { value: "rinkodara", label: "Rinkodara" },
                { value: "longrein", label: "Longrein" },
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

      {/* ---------- Archive ---------- */}
      {archived.length > 0 && (
        <Section title="Praėję laikotarpiai" hint={`${archived.length}`}>
          <Panel padded={false}>
            {archived.map((g) => (
              <div
                key={g.id}
                className="flex items-center gap-3 border-b border-ink-100 px-4 py-2.5 last:border-b-0"
              >
                <span className="w-[74px] shrink-0 text-[11px] tabular-nums text-ink-400">
                  {g.periodStart}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-700">
                  {g.label}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-ink-500">
                  {fmt(g.target, g.unit)}
                </span>
              </div>
            ))}
          </Panel>
          <p className="mt-1.5 px-1 text-[10.5px] leading-snug text-ink-400">
            Rodomas tik tikslas, be galutinio rezultato: skaičiai
            perskaičiuojami „dabar“ atžvilgiu, tad seniems laikotarpiams jie
            būtų neteisingi. Geriau nerodyti nieko negu rodyti netikrą skaičių.
          </p>
        </Section>
      )}
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

                  {/* The forecast, and what to do about it. This is the
                      line she actually reads — the bar above only says
                      where she is, not whether it is enough. */}
                  <p
                    className={`mt-2 rounded-lg px-2.5 py-2 text-[11.5px] leading-relaxed ${
                      g.forecast.willHit
                        ? "bg-emerald-50/70 text-emerald-800"
                        : "bg-amber-50/70 text-amber-900"
                    }`}
                  >
                    {g.advice}
                  </p>
                </>
              ) : (
                <p className="text-[11.5px] leading-snug text-ink-500">
                  {/* A resolver returning null is different from a metric
                      nobody knows how to measure. Say which. */}
                  {GOAL_METRICS.some((m) => m.key === g.goalKey)
                    ? "Kol kas nėra iš ko skaičiuoti — reikia bent dviejų matavimų arba užbaigto 30 d. lango."
                    : "Šio rodiklio automatiškai neskaičiuoju — progresą sek pati."}
                </p>
              )}

              <div className="mt-2.5 flex justify-end">
                {/* .bind, not an arrow function. This is a Server
                    Component, and `async () => deleteGoalAction(g.id)`
                    is a fresh closure — React cannot serialise it across
                    the server/client boundary and the whole screen
                    throws "Functions cannot be passed directly to
                    Client Components". Binding a "use server" export
                    produces another server action, which is a reference
                    React can send. */}
                <ActionButton
                  action={deleteGoalAction.bind(null, g.id)}
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
