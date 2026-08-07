// Screen 1 — Šiandien. The one she opens every morning.
//
// Order is deliberate and reflects how she described the job: what the
// assistant thinks matters today, then what's actually on the calendar,
// then what's waiting on her. Numbers she can act on come before numbers
// she can only look at.

import Link from "next/link";
import { getPersonalContext } from "@/lib/personal/access";
import { getStableTimeZone } from "@/services/personalDashboard/common";
import { getTodayLessons, getOpenTodos, getReengagementList, getPendingRequests } from "@/services/personalDashboard/tjk";
import { getFinanceSnapshot } from "@/services/personalDashboard/finance";
import { getTodayRecommendations } from "@/services/personalDashboard/advisor";
import { getLatestBriefing } from "@/services/personalDashboard/briefing";
import { formatEur } from "@/services/personalDashboard/core.pure";
import {
  ScreenHeader,
  Section,
  Panel,
  Metric,
  Chip,
  Row,
  Empty,
  formatTime,
} from "@/components/personal/ui";
import { ActionButton } from "@/components/personal/interactive";
import { regenerateAdvice } from "@/app/personal/actions";

export const dynamic = "force-dynamic";

export default async function TodayScreen() {
  const now = new Date();
  const ctx = await getPersonalContext();
  const tz = await getStableTimeZone();

  const [lessons, todos, reengagement, requests, finance, advice, briefing] =
    await Promise.all([
      getTodayLessons(now),
      getOpenTodos(now),
      getReengagementList(now),
      getPendingRequests(),
      getFinanceSnapshot(now),
      getTodayRecommendations(now),
      getLatestBriefing(now),
    ]);

  const firstName = (ctx?.fullName ?? "").trim().split(/\s+/)[0] || "Andrėja";
  const overdueTodos = todos.filter((t) => t.overdue).length;
  const upcoming = lessons.filter((l) => new Date(l.startsAt) >= now);

  return (
    <>
      <ScreenHeader eyebrow={longDate(now, tz)} title={`Labas, ${firstName}`} />

      {/* ---------- The three numbers worth knowing before anything else ---------- */}
      <div className="mb-6 grid grid-cols-3 gap-2.5">
        <Metric
          label="Šiandien"
          value={lessons.length}
          hint={upcoming.length > 0 ? `dar ${upcoming.length}` : "viskas įvyko"}
          tone="brand"
        />
        <Metric
          label="Kviesti"
          value={reengagement.length}
          hint="≥14 d. nejojo"
          tone={reengagement.length > 0 ? "warning" : "positive"}
        />
        {/* When a goal exists this shows the goal's OWN actual, not
            money-in-the-bank. The two differ — delivered lessons include
            ones not yet paid for — and showing 290 € here against the
            same 2000 € target that Finansai measures as 390 € is the kind
            of quiet contradiction that makes someone stop trusting every
            other number on the screen. One target, one definition. */}
        <Metric
          label="Mėnuo"
          value={formatEur(finance.goal ? finance.goal.actual : finance.forecast.earnedToDate)}
          hint={
            finance.goal
              ? `iš ${formatEur(finance.goal.target)}`
              : "tikslas nenustatytas"
          }
          tone="saddle"
        />
      </div>

      {/* ---------- AI advisor ---------- */}
      <Section
        title="Ką siūlau šiandien"
        action={
          advice.status === "ok" ? (
            <ActionButton action={regenerateAdvice} variant="ghost" pendingLabel="Galvoju…">
              Atnaujinti
            </ActionButton>
          ) : undefined
        }
      >
        {advice.status === "ok" && advice.recommendations.length > 0 ? (
          <div className="space-y-2.5">
            {advice.recommendations.map((r) => (
              <Panel key={r.id} className="border-l-[3px] border-l-saddle-400">
                <div className="mb-1 flex items-start justify-between gap-3">
                  <p className="text-[13.5px] font-semibold leading-snug text-ink-900">
                    {r.title}
                  </p>
                  <Chip tone={r.priority === "high" ? "danger" : r.priority === "medium" ? "warning" : "neutral"}>
                    {r.category}
                  </Chip>
                </div>
                <p className="text-[12.5px] leading-relaxed text-ink-600">{r.body}</p>
              </Panel>
            ))}
          </div>
        ) : advice.status === "not_configured" ? (
          <Empty
            title="Asistentė dar neįjungta"
            detail="Trūksta Claude API rakto. Įklijuok jį nustatymuose — telefonu, be jokio perkėlimo į Vercel — ir kiekvieną rytą čia atsiras 3–5 pasiūlymai."
            action={
              <Link
                href="/personal/nustatymai"
                className="inline-block rounded-full border border-ink-200 bg-white px-4 py-2 text-[12.5px] font-semibold text-ink-700"
              >
                Įvesti raktą
              </Link>
            }
          />
        ) : advice.status === "refused" ? (
          <Empty title="Šiandien patarimų nėra" detail="Užklausa buvo atmesta. Pabandyk vėliau." />
        ) : (
          <Empty
            title="Šios dienos patarimai dar nesugeneruoti"
            detail="Paspausk ir peržiūrėsiu visus tavo skaičius."
            action={
              <ActionButton action={regenerateAdvice} variant="primary" pendingLabel="Galvoju…">
                Generuoti
              </ActionButton>
            }
          />
        )}
      </Section>

      {/* ---------- Today's schedule ---------- */}
      <Section title="Šios dienos treniruotės" hint={`${lessons.length}`}>
        {lessons.length > 0 ? (
          <Panel padded={false}>
            {lessons.map((l) => {
              const past = new Date(l.startsAt) < now;
              return (
                <Row key={l.id} className={past ? "opacity-55" : undefined}>
                  <span className="w-[46px] shrink-0 font-display text-[15px] tabular-nums text-brand-700">
                    {formatTime(l.startsAt, tz)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-ink-900">
                      {l.clientName ?? "—"}
                    </span>
                    {l.horseName && (
                      <span className="block truncate text-[11px] text-ink-400">{l.horseName}</span>
                    )}
                  </span>
                  {l.price > 0 && (
                    <span className="shrink-0 text-[12px] tabular-nums text-ink-500">
                      {formatEur(l.price)}
                    </span>
                  )}
                </Row>
              );
            })}
          </Panel>
        ) : (
          <Empty title="Šiandien treniruočių nėra" detail="Laisva diena — arba laikas pakviesti ką nors joti." />
        )}
      </Section>

      {/* ---------- Waiting on her ---------- */}
      <Section
        title="Laukia tavęs"
        hint={overdueTodos > 0 ? `${overdueTodos} vėluoja` : undefined}
      >
        {todos.length > 0 || requests.length > 0 ? (
          <Panel padded={false}>
            {requests.map((r) => (
              <Row key={r.id} href="/personal/tjk">
                <Chip tone="brand">Užklausa</Chip>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink-800">
                  {r.requesterName ?? "Klientas"} — {formatTime(r.requestedStart, tz)}
                </span>
              </Row>
            ))}
            {todos.slice(0, 6).map((t) => (
              <Row key={t.id}>
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.overdue ? "bg-rose-400" : "bg-ink-300"}`}
                />
                <span className="min-w-0 flex-1 text-[13px] leading-snug text-ink-800">{t.body}</span>
                {t.overdue && <Chip tone="danger">vėluoja</Chip>}
              </Row>
            ))}
          </Panel>
        ) : (
          <Empty title="Nieko nelaukia" detail="Visi darbai atlikti." />
        )}
      </Section>

      {/* ---------- Gmail briefing ---------- */}
      <Section title="Pašto santrauka">
        {briefing ? (
          <Panel>
            <p className="mb-1 text-[11px] text-ink-400">{briefing.briefingOn}</p>
            {briefing.summary && (
              <p className="text-[12.5px] leading-relaxed text-ink-700">{briefing.summary}</p>
            )}
            {briefing.items.length > 0 && (
              <ul className="mt-2.5 space-y-1.5">
                {briefing.items.slice(0, 5).map((item, i) => (
                  <li key={i} className="flex gap-2 text-[12.5px] leading-snug text-ink-700">
                    <span
                      aria-hidden
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        item.urgency === "high" ? "bg-rose-400" : "bg-ink-300"
                      }`}
                    />
                    <span className="min-w-0">{item.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ) : (
          <Empty
            title="Pašto santraukos dar nėra"
            detail="Gmail apžvalga atkeliauja iš „tjk-daily-inbox-check“ užduoties. Kol ji nesukonfigūruota, čia tuščia — žiūrėk nustatymus."
          />
        )}
      </Section>

      <Link
        href="/personal/nustatymai"
        className="mb-2 block text-center text-[11.5px] text-ink-400 underline underline-offset-4"
      >
        Nustatymai ir integracijos
      </Link>
    </>
  );
}

function longDate(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("lt-LT", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
}
