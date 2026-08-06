// Screen 2 — TJK ops. Who to call, what's booked, what's waiting.
//
// The re-engagement list is the reason this screen exists: her rule is
// "jei nejojo 2 sav jau kviesti", and until now that lived in her head.

import { getStableTimeZone } from "@/services/personalDashboard/common";
import {
  getReengagementList,
  getUpcomingLessons,
  getPendingRequests,
  getOpenTodos,
} from "@/services/personalDashboard/tjk";
import { REENGAGEMENT_DAYS, formatEur } from "@/services/personalDashboard/core.pure";
import {
  ScreenHeader,
  Section,
  Panel,
  Metric,
  Chip,
  Row,
  Empty,
  formatTime,
  formatDay,
} from "@/components/personal/ui";
import { ReengagementCard } from "@/components/personal/interactive";
import { dismissReengagement } from "@/app/personal/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "TJK" };

export default async function TjkScreen() {
  const now = new Date();
  const tz = await getStableTimeZone();

  const [reengagement, upcoming, requests, todos] = await Promise.all([
    getReengagementList(now),
    getUpcomingLessons(14),
    getPendingRequests(),
    getOpenTodos(now),
  ]);

  const overdue = reengagement.filter((r) => r.tone === "overdue").length;
  const never = reengagement.filter((r) => r.tone === "never").length;

  return (
    <>
      <ScreenHeader eyebrow="Klubas" title="TJK" />

      <div className="mb-6 grid grid-cols-3 gap-2.5">
        <Metric label="Kviesti" value={reengagement.length} tone={reengagement.length ? "warning" : "positive"} />
        <Metric label="Labai seniai" value={overdue} hint="≥28 d." tone={overdue ? "danger" : "neutral"} />
        <Metric label="Suplanuota" value={upcoming.length} hint="artimiausios" tone="brand" />
      </div>

      {/* ---------- Re-engagement ---------- */}
      <Section
        title="Verta pakviesti"
        hint={`nejojo ≥${REENGAGEMENT_DAYS} d.`}
      >
        {reengagement.length > 0 ? (
          <Panel padded={false}>
            {reengagement.map((r) => (
              <ReengagementCard
                key={r.clientId}
                item={{
                  clientId: r.clientId,
                  fullName: r.fullName,
                  phone: r.phone,
                  daysSince: r.daysSince,
                  tone: r.tone,
                  suggestedMessage: r.suggestedMessage,
                }}
                onDismiss={dismissReengagement}
              />
            ))}
          </Panel>
        ) : (
          <Empty
            title="Visi aktyvūs"
            detail={`Nė vienas klientas nepraleido ${REENGAGEMENT_DAYS} dienų be treniruotės. Gražu.`}
          />
        )}
        {never > 0 && (
          <p className="mt-2 px-1 text-[11px] text-ink-400">
            Iš jų {never} dar nė karto nejojo — jiems skambutis vertingiausias.
          </p>
        )}
      </Section>

      {/* ---------- Requests ---------- */}
      <Section title="Rezervacijų užklausos" hint={requests.length ? `${requests.length}` : undefined}>
        {requests.length > 0 ? (
          <Panel padded={false}>
            {requests.map((r) => (
              <Row key={r.id}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-ink-900">
                    {r.requesterName ?? "Klientas"}
                  </span>
                  <span className="block text-[11px] text-ink-400">
                    {formatDay(r.requestedStart, tz)} {formatTime(r.requestedStart, tz)} · {r.durationMin} min
                  </span>
                </span>
                <Chip tone="brand">laukia</Chip>
              </Row>
            ))}
          </Panel>
        ) : (
          <Empty title="Naujų užklausų nėra" />
        )}
      </Section>

      {/* ---------- Upcoming ---------- */}
      <Section title="Artimiausios treniruotės">
        {upcoming.length > 0 ? (
          <Panel padded={false}>
            {upcoming.map((l) => (
              <Row key={l.id}>
                <span className="w-[78px] shrink-0 text-[11.5px] leading-tight text-ink-500">
                  <span className="block">{formatDay(l.startsAt, tz)}</span>
                  <span className="block font-display text-[14px] tabular-nums text-brand-700">
                    {formatTime(l.startsAt, tz)}
                  </span>
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
            ))}
          </Panel>
        ) : (
          <Empty title="Kalendorius tuščias" detail="Artimiausiu metu treniruočių nesuplanuota." />
        )}
      </Section>

      {/* ---------- Todos ---------- */}
      <Section title="Sutartys, laiškai, darbai">
        {todos.length > 0 ? (
          <Panel padded={false}>
            {todos.map((t) => (
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
          <Empty
            title="Darbų sąrašas tuščias"
            detail="Šis sąrašas ateina iš Longrein priminimų — ką užsirašai ten, matai čia."
          />
        )}
      </Section>
    </>
  );
}
