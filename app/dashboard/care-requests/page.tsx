// Stable-owner / employee care request inbox.
//
// One screen, three buckets: Open (pending|acknowledged|scheduled),
// Recently closed (done|declined, last 30 days), and a quick metric strip.
// Each open row exposes a Respond button (sheet) — that's the entire
// workflow. No filters, no search; volume is low.

import Link from "next/link";
import { requireBusinessAccount } from "@/lib/auth/redirects";
import {
  listCareRequestsForOwner,
  CARE_TYPE_LABEL,
  CARE_TYPE_EMOJI,
  STATUS_LABEL,
  URGENCY_LABEL,
  type CareRequestWithContext,
} from "@/services/careRequests";
import { RespondButton } from "@/components/careRequests/respond-button";

export const dynamic = "force-dynamic";

export default async function CareRequestsPage() {
  await requireBusinessAccount("owner", "employee");

  const [openRows, closedRows] = await Promise.all([
    listCareRequestsForOwner({ status: "open",  limit: 100 }),
    listCareRequestsForOwner({ limit: 100 }).then((all) =>
      all.filter((r) => r.status === "done" || r.status === "declined").slice(0, 30),
    ),
  ]);

  const urgentOpen = openRows.filter((r) => r.urgency === "high" && r.status === "pending").length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display text-navy-900">Care requests</h1>
          <p className="text-sm text-ink-500 mt-1">
            Service requests from horse owners — farrier, vet, feed, equipment, transport.
          </p>
        </div>
        <div className="flex items-baseline gap-3 text-[12px] text-ink-500">
          <span className="tabular-nums">{openRows.length} open</span>
          {urgentOpen > 0 && (
            <span className="text-red-700 font-medium tabular-nums">
              {urgentOpen} urgent
            </span>
          )}
        </div>
      </header>

      <section className="bg-white rounded-2xl shadow-soft p-5">
        <h2 className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-500 mb-3">
          Open ({openRows.length})
        </h2>
        {openRows.length === 0 ? (
          <p className="text-sm text-ink-500">
            Nothing in the inbox. New horse-owner requests will land here.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {openRows.map((r) => (
              <RequestRow key={r.id} r={r} kind="open" />
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
              <RequestRow key={r.id} r={r} kind="closed" />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function RequestRow({ r, kind }: { r: CareRequestWithContext; kind: "open" | "closed" }) {
  const dateStr = new Date(r.created_at).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short",
  });
  const tone = STATUS_TONE[r.status];

  return (
    <li className="rounded-xl border border-ink-100 bg-white px-4 py-3">
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
            <Link
              href={`/dashboard/horses/${r.horse_id}`}
              className="hover:text-brand-700 underline-offset-2 hover:underline"
            >
              {r.horse_name}
            </Link>
            {r.requester_name && <> · from {r.requester_name}</>}
            {r.preferred_date && (
              <>
                {" · preferred "}
                {new Date(r.preferred_date).toLocaleDateString("en-GB", {
                  day: "2-digit", month: "short",
                })}
              </>
            )}
          </p>
          {r.notes && (
            <p className="text-[12.5px] text-ink-700 mt-2 whitespace-pre-wrap">{r.notes}</p>
          )}
          {r.owner_response && (
            <div className="mt-2 rounded-md bg-ink-50/60 px-3 py-2">
              <p className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 mb-0.5">
                Your response
              </p>
              <p className="text-[12.5px] text-ink-700 whitespace-pre-wrap">
                {r.owner_response}
              </p>
              {r.scheduled_for && (
                <p className="text-[11.5px] text-ink-500 mt-1">
                  Scheduled for{" "}
                  {new Date(r.scheduled_for).toLocaleDateString("en-GB", {
                    day: "2-digit", month: "short", year: "numeric",
                  })}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span
            className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${tone}`}
          >
            {STATUS_LABEL[r.status]}
          </span>
          <span className="text-[11px] text-ink-400">{dateStr}</span>
          {kind === "open" && <RespondButton requestId={r.id} defaultStatus={r.status} />}
        </div>
      </div>
    </li>
  );
}

const STATUS_TONE: Record<string, string> = {
  pending:      "bg-amber-50  text-amber-700",
  acknowledged: "bg-sky-50    text-sky-700",
  scheduled:    "bg-brand-50  text-brand-700",
  done:         "bg-emerald-50 text-emerald-700",
  declined:     "bg-ink-100   text-ink-600",
};
