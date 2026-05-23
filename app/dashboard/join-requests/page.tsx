// Owner / employee inbox for public stable-join applications.
// Approve creates the clients row + auto-sends the invitation email.

import Link from "next/link";
import { requirePageRole } from "@/lib/auth/redirects";
import {
  listJoinRequestsForOwner,
  type JoinRequestRow,
} from "@/services/joinRequests";
import { getOwnStable } from "@/services/stables";
import { ApproveRejectButtons } from "@/components/joinRequests/approve-reject-buttons";

export const dynamic = "force-dynamic";

export default async function JoinRequestsPage() {
  await requirePageRole("owner", "employee");

  const [openRows, allRows, stable] = await Promise.all([
    listJoinRequestsForOwner({ status: "open", limit: 100 }),
    listJoinRequestsForOwner({ limit: 100 }),
    getOwnStable().catch(() => null),
  ]);

  const closedRows = allRows.filter((r) => r.status !== "pending").slice(0, 30);
  const publicLink = stable
    ? `https://longrein.eu/signup/join/${stable.slug}`
    : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display text-navy-900">Join requests</h1>
          <p className="text-sm text-ink-500 mt-1">
            People applying to join your stable. Approve creates their client
            record and emails an invitation link to set their password.
          </p>
        </div>
        <span className="text-[12px] text-ink-500 tabular-nums">
          {openRows.length} pending
        </span>
      </header>

      {publicLink && (
        <section className="bg-white rounded-2xl shadow-soft p-4">
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-500">
            Your public join link
          </p>
          <p className="text-sm font-mono text-navy-900 mt-1 break-all">{publicLink}</p>
          <p className="text-[11.5px] text-ink-500 mt-2">
            Share this with riders + horse owners. Toggle public joins off any
            time from{" "}
            <Link
              href="/dashboard/settings/stable"
              className="text-brand-700 hover:text-brand-800 underline-offset-2 hover:underline"
            >
              Settings → Stable
            </Link>
            .
          </p>
        </section>
      )}

      <section className="bg-white rounded-2xl shadow-soft p-5">
        <h2 className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-500 mb-3">
          Open ({openRows.length})
        </h2>
        {openRows.length === 0 ? (
          <p className="text-sm text-ink-500">
            No pending applications. New applicants will land here automatically.
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

function RequestRow({ r, kind }: { r: JoinRequestRow; kind: "open" | "closed" }) {
  const dateStr = new Date(r.created_at).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short",
  });
  const tone = STATUS_TONE[r.status];

  return (
    <li className="rounded-xl border border-ink-100 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-900">
            {r.full_name}{" "}
            <span className="text-[11px] uppercase tracking-wider font-semibold text-ink-500 ml-1">
              {r.requested_role === "horse_owner" ? "Horse owner" : "Rider"}
            </span>
          </p>
          <p className="text-[12px] text-ink-500 mt-0.5">
            {r.email}
            {r.phone && <> · {r.phone}</>}
          </p>
          {r.message && (
            <p className="text-[12.5px] text-ink-700 mt-2 whitespace-pre-wrap">
              {r.message}
            </p>
          )}
          {r.status === "rejected" && r.decline_reason && (
            <p className="text-[12px] text-ink-600 mt-2 whitespace-pre-wrap">
              Reason: {r.decline_reason}
            </p>
          )}
          {r.status === "approved" && r.created_client_id && (
            <Link
              href={`/dashboard/clients/${r.created_client_id}`}
              className="text-[11.5px] text-brand-700 hover:text-brand-900 mt-2 inline-block"
            >
              Open client profile →
            </Link>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span
            className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${tone}`}
          >
            {STATUS_LABEL[r.status]}
          </span>
          <span className="text-[11px] text-ink-400">{dateStr}</span>
          {kind === "open" && (
            <ApproveRejectButtons requestId={r.id} applicantName={r.full_name} />
          )}
        </div>
      </div>
    </li>
  );
}

const STATUS_LABEL: Record<string, string> = {
  pending:   "Pending",
  approved:  "Approved",
  rejected:  "Rejected",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<string, string> = {
  pending:   "bg-amber-50  text-amber-700",
  approved:  "bg-emerald-50 text-emerald-700",
  rejected:  "bg-ink-100   text-ink-600",
  cancelled: "bg-ink-100   text-ink-500",
};
