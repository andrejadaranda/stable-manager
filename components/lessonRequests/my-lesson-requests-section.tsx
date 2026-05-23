// Server-rendered "My lesson requests" section for the client portal.
// Shows pending requests with Cancel, plus the last 5 closed (accepted /
// declined) for transparency. Auto-hides when nothing exists.

import Link from "next/link";
import {
  LESSON_STATUS_LABEL,
  type LessonRequestWithContext,
} from "@/services/lessonRequests.types";
import { cancelLessonRequestAction } from "@/app/dashboard/my-lessons/request-actions";

export function MyLessonRequestsSection({
  items,
}: {
  items: LessonRequestWithContext[];
}) {
  if (items.length === 0) return null;

  const pending = items.filter((r) => r.status === "pending");
  const closed  = items.filter((r) => r.status !== "pending").slice(0, 5);

  return (
    <section className="bg-white rounded-2xl shadow-soft p-5 md:p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-display text-xl text-navy-900">My lesson requests</h2>
        <span className="text-[11px] uppercase tracking-[0.14em] font-medium text-ink-500">
          {pending.length} pending
        </span>
      </div>

      {pending.length > 0 && (
        <ul className="flex flex-col gap-2 mb-4">
          {pending.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-amber-100 bg-amber-50/40 px-4 py-3"
            >
              <RowBody r={r} />
              <form action={cancelLessonRequestAction} className="mt-2">
                <input type="hidden" name="request_id" value={r.id} />
                {r.horse_id && (
                  <input type="hidden" name="horse_id" value={r.horse_id} />
                )}
                <button
                  type="submit"
                  className="text-[11.5px] text-red-600 hover:text-red-800"
                >
                  Cancel request
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {closed.length > 0 && (
        <>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-ink-500 mb-2 mt-1">
            Recent
          </p>
          <ul className="flex flex-col gap-2">
            {closed.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-ink-100 bg-white px-4 py-3"
              >
                <RowBody r={r} />
                {r.status === "accepted" && r.accepted_lesson_id && (
                  <Link
                    href="/dashboard/my-lessons"
                    className="text-[11.5px] text-brand-700 hover:text-brand-900 mt-1 inline-block"
                  >
                    See it on your calendar →
                  </Link>
                )}
                {r.status === "declined" && r.decline_reason && (
                  <p className="text-[12px] text-ink-600 mt-2 whitespace-pre-wrap">
                    Reason: {r.decline_reason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function RowBody({ r }: { r: LessonRequestWithContext }) {
  const date = new Date(r.requested_start);
  const dateStr = date.toLocaleString("en-GB", {
    weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/Vilnius",
  });
  const tone = STATUS_TONE[r.status];

  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-900">
          {dateStr} · {r.requested_duration_min} min
        </p>
        <p className="text-[12px] text-ink-500 mt-0.5">
          {r.horse_name ?? "No horse preference"}
          {r.preferred_trainer_name && <> · with {r.preferred_trainer_name}</>}
        </p>
        {r.notes && (
          <p className="text-[12px] text-ink-700 mt-1.5 whitespace-pre-wrap">{r.notes}</p>
        )}
      </div>
      <span
        className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${tone}`}
      >
        {LESSON_STATUS_LABEL[r.status]}
      </span>
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  pending:   "bg-amber-50  text-amber-700",
  accepted:  "bg-emerald-50 text-emerald-700",
  declined:  "bg-ink-100   text-ink-600",
  cancelled: "bg-ink-100   text-ink-500",
};
