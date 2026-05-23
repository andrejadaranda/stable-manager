// Join requests widget — pending applications waiting on the owner.
// Auto-hides when none open. High prominence: applicants are revenue
// adjacent (rider/horse-owner converts to active client = monetisation).

import Link from "next/link";
import type { JoinRequestRow } from "@/services/joinRequests";

export function JoinRequestsWidget({ items }: { items: JoinRequestRow[] }) {
  if (items.length === 0) return null;

  const top = items.slice(0, 5);

  return (
    <section className="bg-white rounded-2xl shadow-soft p-5 md:p-6">
      <div className="flex items-baseline justify-between mb-4 gap-3">
        <h2 className="font-display text-xl text-navy-900 leading-none flex items-baseline gap-2">
          <span aria-hidden>👋</span>
          New applications
        </h2>
        <Link
          href="/dashboard/join-requests"
          className="text-[11px] uppercase tracking-[0.14em] font-semibold text-brand-700 hover:text-brand-800"
        >
          Review →
        </Link>
      </div>

      <ul className="flex flex-col gap-2">
        {top.map((r) => (
          <li key={r.id}>
            <Link
              href="/dashboard/join-requests"
              className="
                flex items-center gap-3 px-3 py-2 rounded-xl
                bg-surface/40 hover:bg-surface/80 transition-colors group
              "
            >
              <span
                aria-hidden
                className="
                  shrink-0 w-9 h-9 rounded-xl inline-flex items-center justify-center
                  bg-brand-50 text-brand-700 font-semibold text-sm
                "
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                {r.full_name[0]?.toUpperCase() ?? "?"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-navy-900 truncate">
                  {r.full_name}
                </p>
                <p className="text-[11.5px] text-ink-500 truncate">
                  {r.requested_role === "horse_owner" ? "Horse owner" : "Rider"} · {r.email}
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
          {items.length - top.length} more pending
        </p>
      )}
    </section>
  );
}
