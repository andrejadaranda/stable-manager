// Care requests widget for the owner overview.
// Renders only when there's at least one open (pending|acknowledged|scheduled)
// request — keeps the dashboard quiet when nothing needs attention.

import Link from "next/link";
import {
  CARE_TYPE_EMOJI,
  CARE_TYPE_LABEL,
  URGENCY_LABEL,
  STATUS_LABEL,
  type CareRequestWithContext,
} from "@/services/careRequests";

export function CareRequestsWidget({ items }: { items: CareRequestWithContext[] }) {
  if (items.length === 0) return null;

  const urgent = items.filter((r) => r.urgency === "high" && r.status === "pending");
  const top    = items.slice(0, 5);

  return (
    <section className="bg-white rounded-2xl shadow-soft p-5 md:p-6">
      <div className="flex items-baseline justify-between mb-4 gap-3">
        <h2 className="font-display text-xl text-navy-900 leading-none flex items-baseline gap-2">
          <span aria-hidden>🛠️</span>
          Care requests
        </h2>
        <Link
          href="/dashboard/care-requests"
          className="text-[11px] uppercase tracking-[0.14em] font-semibold text-brand-700 hover:text-brand-800"
        >
          Open inbox →
        </Link>
      </div>

      {urgent.length > 0 && (
        <p className="text-[12.5px] text-red-700 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-3">
          <span className="font-semibold">{urgent.length} urgent</span> waiting on you.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {top.map((r) => (
          <li key={r.id}>
            <Link
              href="/dashboard/care-requests"
              className="
                flex items-center gap-3 px-3 py-2 rounded-xl
                bg-surface/40 hover:bg-surface/80 transition-colors group
              "
            >
              <span
                className="
                  shrink-0 w-9 h-9 rounded-xl inline-flex items-center justify-center
                  bg-brand-50 text-brand-700 text-base
                "
                aria-hidden
              >
                {CARE_TYPE_EMOJI[r.type]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-navy-900 truncate">
                  {CARE_TYPE_LABEL[r.type]} · {r.horse_name}
                </p>
                <p className="text-[11.5px] text-ink-500 truncate">
                  {URGENCY_LABEL[r.urgency]} · {STATUS_LABEL[r.status]}
                  {r.requester_name && <> · {r.requester_name}</>}
                </p>
              </div>
              <span
                className="text-ink-300 group-hover:text-brand-700 transition-colors shrink-0"
                aria-hidden
              >
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {items.length > top.length && (
        <p className="text-[11.5px] text-ink-500 mt-3 text-center">
          {items.length - top.length} more in the inbox
        </p>
      )}
    </section>
  );
}
