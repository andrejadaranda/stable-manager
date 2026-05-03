// Settings → Activity. Owner-only feed of every write captured by the
// audit_log trigger. Renders chronologically with actor + table verb.
//
// The page links into the originating row when the table maps to a
// browseable detail page (lessons → calendar, horses → horse profile,
// etc.). Tables without a detail view fall through to a plain text
// row so nothing 404s.

import Link from "next/link";
import { requirePageRole } from "@/lib/auth/redirects";
import { listAuditLog, type AuditLogRow } from "@/services/auditLog";
import { HelpHint } from "@/components/ui";

export const dynamic = "force-dynamic";

const TABLE_LABEL: Record<string, string> = {
  lessons:                 "Lesson",
  payments:                "Payment",
  lesson_packages:         "Package",
  horse_boarding_charges:  "Boarding charge",
  client_charges:          "Misc charge",
  client_agreements:       "Agreement",
  services:                "Service",
  horses:                  "Horse",
};

const ACTION_VERB: Record<string, string> = {
  insert: "created",
  update: "edited",
  delete: "deleted",
};

const ACTION_TONE: Record<string, string> = {
  insert: "bg-emerald-50 text-emerald-700",
  update: "bg-amber-50 text-amber-700",
  delete: "bg-rose-50 text-rose-700",
};

function detailHref(row: AuditLogRow): string | null {
  switch (row.table_name) {
    case "horses":          return `/dashboard/horses/${row.row_id}`;
    case "services":        return `/dashboard/settings/services`;
    // Lessons live inside the calendar; a deep-link by id needs a
    // calendar param we haven't shipped yet — point at the calendar
    // root for now so the user lands somewhere useful.
    case "lessons":         return `/dashboard/calendar`;
    default:                return null;
  }
}

export default async function AuditPage() {
  await requirePageRole("owner");
  const rows = await listAuditLog({ limit: 200 });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-ink-900">
            Activity log
          </h2>
          <HelpHint
            title="Activity log"
            body={
              <>
                <p>Every write to your stable&apos;s data — who created, edited, or deleted what, and when. Captured at the database level by a trigger, so nothing slips through.</p>
                <p><strong>Tamper-evident:</strong> rows here can&apos;t be edited or deleted by anyone (including you) — only added by the system. That&apos;s what makes it audit-quality.</p>
                <p>Use it to answer &quot;who marked that lesson paid?&quot; or &quot;when was this horse&apos;s fee last changed?&quot;. Click a row (where available) to open the affected record.</p>
              </>
            }
          />
        </div>
        <p className="text-sm text-ink-500 mt-1">
          Every change to lessons, payments, packages, boarding,
          horses, services, charges, and agreements — captured at the
          database level. Tamper-evident: rows can&apos;t be edited or
          deleted, only added by the system trigger.
        </p>
      </div>

      <section className="bg-white rounded-2xl shadow-soft overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-semibold text-navy-900">No activity yet</p>
            <p className="text-[12.5px] text-ink-500 mt-1">
              Once your team starts booking lessons and recording payments,
              every write will appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {rows.map((r) => {
              const href = detailHref(r);
              const Inner = (
                <div className="px-5 py-3 flex items-center gap-3 hover:bg-ink-100/40 transition-colors">
                  <span
                    className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-[0.06em] ${ACTION_TONE[r.action]}`}
                  >
                    {ACTION_VERB[r.action]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-navy-900">
                      <span className="font-semibold">{r.actor?.full_name ?? "(system)"}</span>
                      <span className="text-ink-500">
                        {` ${ACTION_VERB[r.action]} a `}
                        {(TABLE_LABEL[r.table_name] ?? r.table_name).toLowerCase()}
                      </span>
                      {r.changes_summary && r.changes_summary !== ACTION_VERB[r.action] + "d" && (
                        <span className="text-ink-700"> · {r.changes_summary}</span>
                      )}
                    </p>
                    <p className="text-[11px] text-ink-500 tabular-nums mt-0.5">
                      {fmtRelative(r.created_at)}
                      {r.actor_role && ` · ${r.actor_role}`}
                    </p>
                  </div>
                </div>
              );
              return (
                <li key={r.id}>
                  {href ? <Link href={href}>{Inner}</Link> : Inner}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function fmtRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1)        return "just now";
  if (min < 60)       return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr  < 24)       return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day === 1)      return "yesterday";
  if (day < 7)        return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
