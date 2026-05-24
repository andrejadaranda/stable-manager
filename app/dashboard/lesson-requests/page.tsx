// Stable owner / employee lesson-request inbox.
//
// Same structural shape as /dashboard/care-requests — Open bucket
// (status='pending') with Accept/Decline buttons, and a Recently closed
// bucket (accepted/declined/cancelled, last 30 rows). Accept opens a
// sheet that pre-fills the requested time and lets the owner adjust
// horse/trainer/time/duration/price before confirming. The confirm
// goes through accept_lesson_request RPC which creates the real
// lessons row.

import Link from "next/link";
import { requireBusinessAccount } from "@/lib/auth/redirects";
import {
  listLessonRequestsForOwner,
  LESSON_STATUS_LABEL,
  type LessonRequestWithContext,
} from "@/services/lessonRequests";
import { listHorses } from "@/services/horses";
import { listTrainers } from "@/services/profiles";
import { RespondLessonRequestButtons } from "@/components/lessonRequests/accept-decline-buttons";

export const dynamic = "force-dynamic";

export default async function LessonRequestsPage() {
  await requireBusinessAccount("owner", "employee");

  const [openRows, allRows, horses, trainers] = await Promise.all([
    listLessonRequestsForOwner({ status: "open", limit: 100 }),
    listLessonRequestsForOwner({ limit: 100 }),
    listHorses({ activeOnly: true, lessonsOnly: true }).catch(() => []),
    listTrainers().catch(() => []),
  ]);

  const closedRows = allRows
    .filter((r) => r.status !== "pending")
    .slice(0, 30);

  const horseOpts   = horses.map((h) => ({ id: h.id, name: h.name }));
  const trainerOpts = trainers.map((t) => ({ id: t.id, full_name: t.full_name }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display text-navy-900">Lesson requests</h1>
          <p className="text-sm text-ink-500 mt-1">
            Clients propose a date and time. Confirm to add the lesson to your
            calendar — overlap, daily limits, and weekly limits still apply.
          </p>
        </div>
        <span className="text-[12px] text-ink-500 tabular-nums">
          {openRows.length} pending
        </span>
      </header>

      <section className="bg-white rounded-2xl shadow-soft p-5">
        <h2 className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-500 mb-3">
          Open ({openRows.length})
        </h2>
        {openRows.length === 0 ? (
          <p className="text-sm text-ink-500">
            Nothing to action. New client requests will land here.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {openRows.map((r) => (
              <RequestRow
                key={r.id}
                r={r}
                kind="open"
                horses={horseOpts}
                trainers={trainerOpts}
              />
            ))}
          </ul>
        )}
      </section>

      {closedRows.length > 0 && (
        <section className="bg-white rounded-2xl shadow-soft p-5">
          <h2 className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-500 mb-3">
            Recently closed
          </h2>
          <ul className="flex flex-col gap-3">
            {closedRows.map((r) => (
              <RequestRow
                key={r.id}
                r={r}
                kind="closed"
                horses={horseOpts}
                trainers={trainerOpts}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function RequestRow({
  r,
  kind,
  horses,
  trainers,
}: {
  r:        LessonRequestWithContext;
  kind:     "open" | "closed";
  horses:   { id: string; name: string }[];
  trainers: { id: string; full_name: string }[];
}) {
  const date = new Date(r.requested_start);
  const dateStr = date.toLocaleString("en-GB", {
    weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/Vilnius",
  });
  const tone = STATUS_TONE[r.status];

  return (
    <li className="rounded-xl border border-ink-100 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-900">
            {dateStr} · {r.requested_duration_min} min
          </p>
          <p className="text-[12px] text-ink-500 mt-0.5">
            {r.requester_name ?? "Client"}
            {r.horse_name ? <> · prefers {r.horse_name}</> : <> · no horse preference</>}
            {r.preferred_trainer_name && <> · with {r.preferred_trainer_name}</>}
          </p>
          {r.notes && (
            <p className="text-[12.5px] text-ink-700 mt-2 whitespace-pre-wrap">
              {r.notes}
            </p>
          )}
          {r.status === "accepted" && r.accepted_lesson_id && (
            <Link
              href="/dashboard/calendar"
              className="text-[11.5px] text-brand-700 hover:text-brand-900 mt-2 inline-block"
            >
              View in calendar →
            </Link>
          )}
          {r.status === "declined" && r.decline_reason && (
            <p className="text-[12px] text-ink-600 mt-2 whitespace-pre-wrap">
              Reason: {r.decline_reason}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span
            className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${tone}`}
          >
            {LESSON_STATUS_LABEL[r.status]}
          </span>
          {kind === "open" && (
            <RespondLessonRequestButtons
              requestId={r.id}
              requestedStart={r.requested_start}
              requestedDurationMin={r.requested_duration_min}
              presetHorseId={r.horse_id ?? undefined}
              presetTrainerId={r.preferred_trainer_id ?? undefined}
              horses={horses}
              trainers={trainers}
            />
          )}
        </div>
      </div>
    </li>
  );
}

const STATUS_TONE: Record<string, string> = {
  pending:   "bg-amber-50  text-amber-700",
  accepted:  "bg-emerald-50 text-emerald-700",
  declined:  "bg-ink-100   text-ink-600",
  cancelled: "bg-ink-100   text-ink-500",
};
