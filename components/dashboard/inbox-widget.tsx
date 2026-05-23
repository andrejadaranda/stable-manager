// Combined Inbox widget on /dashboard. One row per request type
// with a count, surfacing the single highest-priority item per
// section. Click leads to /dashboard/inbox.

import Link from "next/link";
import type { JoinRequestRow } from "@/services/joinRequests";
import type { LessonRequestWithContext } from "@/services/lessonRequests.types";
import type { CareRequestWithContext } from "@/services/careRequests.types";

export function InboxWidget({
  joinOpen,
  lessonOpen,
  careOpen,
}: {
  joinOpen:   JoinRequestRow[];
  lessonOpen: LessonRequestWithContext[];
  careOpen:   CareRequestWithContext[];
}) {
  const total = joinOpen.length + lessonOpen.length + careOpen.length;
  if (total === 0) return null;

  const urgentCare = careOpen.filter((r) => r.urgency === "high" && r.status === "pending").length;

  return (
    <section className="bg-white rounded-2xl shadow-soft p-5 md:p-6">
      <div className="flex items-baseline justify-between mb-4 gap-3">
        <h2 className="font-display text-xl text-navy-900 leading-none flex items-baseline gap-2">
          <span aria-hidden>📬</span>
          Inbox
          <span className="text-[12px] text-ink-500 font-normal ml-1">
            {total} waiting
          </span>
        </h2>
        <Link
          href="/dashboard/inbox"
          className="text-[11px] uppercase tracking-[0.14em] font-semibold text-brand-700 hover:text-brand-800"
        >
          Open →
        </Link>
      </div>

      <ul className="flex flex-col gap-2">
        {joinOpen.length > 0 && (
          <Row
            href="/dashboard/inbox"
            emoji="👋"
            title={`${joinOpen.length} new ${joinOpen.length === 1 ? "applicant" : "applicants"}`}
            sub={joinOpen.slice(0, 2).map((r) => r.full_name).join(", ") +
                 (joinOpen.length > 2 ? ` + ${joinOpen.length - 2} more` : "")}
            tone="brand"
          />
        )}
        {lessonOpen.length > 0 && (
          <Row
            href="/dashboard/inbox"
            emoji="📅"
            title={`${lessonOpen.length} lesson ${lessonOpen.length === 1 ? "request" : "requests"}`}
            sub={lessonOpen.slice(0, 2).map((r) => r.requester_name ?? "Client").join(", ") +
                 (lessonOpen.length > 2 ? ` + ${lessonOpen.length - 2} more` : "")}
            tone="amber"
          />
        )}
        {careOpen.length > 0 && (
          <Row
            href="/dashboard/inbox"
            emoji="🛠️"
            title={`${careOpen.length} care ${careOpen.length === 1 ? "request" : "requests"}`}
            sub={
              urgentCare > 0
                ? `${urgentCare} urgent — needs attention now`
                : careOpen.slice(0, 2).map((r) => `${r.horse_name} (${r.requester_name ?? "owner"})`).join(", ")
            }
            tone={urgentCare > 0 ? "red" : "navy"}
          />
        )}
      </ul>
    </section>
  );
}

function Row({
  href,
  emoji,
  title,
  sub,
  tone,
}: {
  href:  string;
  emoji: string;
  title: string;
  sub:   string;
  tone:  "brand" | "amber" | "navy" | "red";
}) {
  const toneBg = {
    brand: "bg-brand-50 text-brand-700",
    amber: "bg-amber-50 text-amber-700",
    navy:  "bg-navy-50  text-navy-700",
    red:   "bg-red-50   text-red-700",
  }[tone];
  return (
    <li>
      <Link
        href={href}
        className="
          flex items-center gap-3 px-3 py-2 rounded-xl
          bg-surface/40 hover:bg-surface/80 transition-colors group
        "
      >
        <span aria-hidden className={`shrink-0 w-9 h-9 rounded-xl inline-flex items-center justify-center text-base ${toneBg}`}>
          {emoji}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-navy-900 truncate">{title}</p>
          <p className="text-[11.5px] text-ink-500 truncate">{sub}</p>
        </div>
        <span className="text-ink-300 group-hover:text-brand-700 transition-colors shrink-0" aria-hidden>→</span>
      </Link>
    </li>
  );
}
