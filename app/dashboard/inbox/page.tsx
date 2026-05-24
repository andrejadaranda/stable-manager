// Unified Inbox — Join + Lesson + Care requests in one place.
//
// Replaces /dashboard/join-requests, /dashboard/lesson-requests,
// /dashboard/care-requests as the single owner action surface. At
// Founding 15 scale the volume is low and three separate pages was
// unnecessary clicking. Each section shows up to 5 pending items
// with the full Respond / Approve / Accept controls inline; closed
// rows stay accessible via the individual archive pages.

import Link from "next/link";
import { requireBusinessAccount } from "@/lib/auth/redirects";
import {
  listJoinRequestsForOwner,
  type JoinRequestRow,
} from "@/services/joinRequests";
import {
  listLessonRequestsForOwner,
  type LessonRequestWithContext,
} from "@/services/lessonRequests";
import {
  listCareRequestsForOwner,
  type CareRequestWithContext,
} from "@/services/careRequests";
import {
  CARE_TYPE_EMOJI,
  CARE_TYPE_LABEL,
  URGENCY_LABEL,
  STATUS_LABEL as CARE_STATUS_LABEL,
} from "@/services/careRequests.types";
import { LESSON_STATUS_LABEL } from "@/services/lessonRequests.types";
import { listHorses } from "@/services/horses";
import { listTrainers } from "@/services/profiles";
import { getOwnStable } from "@/services/stables";
import { ApproveRejectButtons } from "@/components/joinRequests/approve-reject-buttons";
import { RespondLessonRequestButtons } from "@/components/lessonRequests/accept-decline-buttons";
import { RespondButton } from "@/components/careRequests/respond-button";

export const dynamic = "force-dynamic";

const TOP_N = 5;

export default async function InboxPage() {
  await requireBusinessAccount("owner", "employee");

  const [
    joinOpen,
    lessonOpen,
    careOpen,
    horses,
    trainers,
    stable,
  ] = await Promise.all([
    listJoinRequestsForOwner({ status: "open", limit: 25 }),
    listLessonRequestsForOwner({ status: "open", limit: 25 }),
    listCareRequestsForOwner({ status: "open", limit: 25 }),
    listHorses({ activeOnly: true, lessonsOnly: true }).catch(() => []),
    listTrainers().catch(() => []),
    getOwnStable().catch(() => null),
  ]);

  const totalOpen = joinOpen.length + lessonOpen.length + careOpen.length;
  const horseOpts   = horses.map((h) => ({ id: h.id, name: h.name }));
  const trainerOpts = trainers.map((t) => ({ id: t.id, full_name: t.full_name }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display text-navy-900">Inbox</h1>
          <p className="text-sm text-ink-500 mt-1">
            {totalOpen === 0
              ? "Nothing waiting on you."
              : `${totalOpen} ${totalOpen === 1 ? "item" : "items"} waiting — ${joinOpen.length} new clients · ${lessonOpen.length} lesson requests · ${careOpen.length} care requests.`}
          </p>
        </div>
      </header>

      {totalOpen === 0 ? (
        <section className="bg-white rounded-2xl shadow-soft p-10 text-center">
          <span aria-hidden className="text-3xl">📬</span>
          <p className="text-sm text-ink-700 font-medium mt-3">All caught up.</p>
          <p className="text-[12.5px] text-ink-500 mt-1 max-w-md mx-auto">
            New stable-join applications, lesson booking requests, and care
            requests will land here.
          </p>
        </section>
      ) : (
        <>
          <JoinSection items={joinOpen} stableSlug={stable?.slug ?? null} />
          <LessonSection items={lessonOpen} horses={horseOpts} trainers={trainerOpts} />
          <CareSection items={careOpen} />
        </>
      )}

      <section className="bg-white rounded-2xl shadow-soft p-5">
        <h2 className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-500 mb-3">
          Archives
        </h2>
        <ul className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
          <ArchiveLink href="/dashboard/join-requests"   label="Join requests history" />
          <ArchiveLink href="/dashboard/lesson-requests" label="Lesson requests history" />
          <ArchiveLink href="/dashboard/care-requests"   label="Care requests history" />
        </ul>
      </section>
    </div>
  );
}

function ArchiveLink({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="
          inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm
          bg-ink-50/60 text-ink-700 hover:bg-ink-100 transition-colors
        "
      >
        {label} <span aria-hidden>→</span>
      </Link>
    </li>
  );
}

// =============================================================
// Sections
// =============================================================

function JoinSection({
  items,
  stableSlug,
}: {
  items: JoinRequestRow[];
  stableSlug: string | null;
}) {
  if (items.length === 0) return null;
  const top = items.slice(0, TOP_N);
  return (
    <section className="bg-white rounded-2xl shadow-soft p-5">
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <h2 className="font-display text-lg text-navy-900 leading-none flex items-baseline gap-2">
          <span aria-hidden>👋</span>
          New stable applications
          <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-500 ml-1">
            {items.length}
          </span>
        </h2>
        {stableSlug && (
          <span className="text-[11.5px] text-ink-500">
            Your link: <span className="font-mono">app.longrein.eu/signup/join/{stableSlug}</span>
          </span>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        {top.map((r) => (
          <li key={r.id} className="rounded-xl border border-ink-100 bg-white px-4 py-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-900">
                  {r.full_name}{" "}
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-ink-500 ml-1">
                    {r.requested_role === "horse_owner" ? "Horse owner" : "Rider"}
                  </span>
                </p>
                <p className="text-[12px] text-ink-500 mt-0.5">
                  {r.email}{r.phone && <> · {r.phone}</>}
                </p>
                {r.message && (
                  <p className="text-[12.5px] text-ink-700 mt-2 whitespace-pre-wrap">
                    {r.message}
                  </p>
                )}
              </div>
              <div className="shrink-0">
                <ApproveRejectButtons requestId={r.id} applicantName={r.full_name} />
              </div>
            </div>
          </li>
        ))}
      </ul>
      {items.length > top.length && (
        <p className="text-[11.5px] text-ink-500 mt-3">
          + {items.length - top.length} more —{" "}
          <Link href="/dashboard/join-requests" className="text-brand-700 hover:text-brand-800 underline-offset-2 hover:underline">
            see all
          </Link>
        </p>
      )}
    </section>
  );
}

function LessonSection({
  items,
  horses,
  trainers,
}: {
  items:    LessonRequestWithContext[];
  horses:   { id: string; name: string }[];
  trainers: { id: string; full_name: string }[];
}) {
  if (items.length === 0) return null;
  const top = items.slice(0, TOP_N);
  return (
    <section className="bg-white rounded-2xl shadow-soft p-5">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="font-display text-lg text-navy-900 leading-none flex items-baseline gap-2">
          <span aria-hidden>📅</span>
          Lesson requests
          <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-500 ml-1">
            {items.length}
          </span>
        </h2>
      </div>
      <ul className="flex flex-col gap-2">
        {top.map((r) => {
          const date = new Date(r.requested_start);
          const dateStr = date.toLocaleString("en-GB", {
            weekday: "short", day: "2-digit", month: "short",
            hour: "2-digit", minute: "2-digit",
            timeZone: "Europe/Vilnius",
          });
          return (
            <li key={r.id} className="rounded-xl border border-ink-100 bg-white px-4 py-3">
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
                </div>
                <div className="shrink-0">
                  <RespondLessonRequestButtons
                    requestId={r.id}
                    requestedStart={r.requested_start}
                    requestedDurationMin={r.requested_duration_min}
                    presetHorseId={r.horse_id ?? undefined}
                    presetTrainerId={r.preferred_trainer_id ?? undefined}
                    horses={horses}
                    trainers={trainers}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {items.length > top.length && (
        <p className="text-[11.5px] text-ink-500 mt-3">
          + {items.length - top.length} more —{" "}
          <Link href="/dashboard/lesson-requests" className="text-brand-700 hover:text-brand-800 underline-offset-2 hover:underline">
            see all
          </Link>
        </p>
      )}
    </section>
  );
}

function CareSection({ items }: { items: CareRequestWithContext[] }) {
  if (items.length === 0) return null;
  const top = items.slice(0, TOP_N);
  const urgent = items.filter((r) => r.urgency === "high" && r.status === "pending").length;
  return (
    <section className="bg-white rounded-2xl shadow-soft p-5">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="font-display text-lg text-navy-900 leading-none flex items-baseline gap-2">
          <span aria-hidden>🛠️</span>
          Care requests
          <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-500 ml-1">
            {items.length}
          </span>
        </h2>
        {urgent > 0 && (
          <span className="text-[11px] text-red-700 font-semibold">
            {urgent} urgent
          </span>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        {top.map((r) => {
          const dateStr = new Date(r.created_at).toLocaleDateString("en-GB", {
            day: "2-digit", month: "short",
          });
          return (
            <li key={r.id} className="rounded-xl border border-ink-100 bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-900 flex items-center gap-2 flex-wrap">
                    <span aria-hidden>{CARE_TYPE_EMOJI[r.type]}</span>
                    {CARE_TYPE_LABEL[r.type]}
                    <span className="text-[11px] text-ink-400 font-normal">
                      · {URGENCY_LABEL[r.urgency]}
                    </span>
                    {r.urgency === "high" && r.status === "pending" && (
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
                        Urgent
                      </span>
                    )}
                  </p>
                  <p className="text-[12px] text-ink-500 mt-0.5">
                    {r.horse_name}
                    {r.requester_name && <> · from {r.requester_name}</>}
                    {" · "}{dateStr}
                  </p>
                  {r.notes && (
                    <p className="text-[12.5px] text-ink-700 mt-2 whitespace-pre-wrap">{r.notes}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700">
                    {CARE_STATUS_LABEL[r.status]}
                  </span>
                  <RespondButton requestId={r.id} defaultStatus={r.status} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {items.length > top.length && (
        <p className="text-[11.5px] text-ink-500 mt-3">
          + {items.length - top.length} more —{" "}
          <Link href="/dashboard/care-requests" className="text-brand-700 hover:text-brand-800 underline-offset-2 hover:underline">
            see all
          </Link>
        </p>
      )}
    </section>
  );
}

// Mark LESSON_STATUS_LABEL as referenced so eslint doesn't trip if we later
// surface lesson row statuses inline.
void LESSON_STATUS_LABEL;
