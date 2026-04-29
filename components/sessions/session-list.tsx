// Server component — feed of sessions.
//
// Refresh (2026-04-29):
//   * Cards on cream surface with rounded-2xl + shadow-soft, matching
//     the calendar lesson cards.
//   * Type pills in tone-coded colors (flat=brand, jumping=emerald,
//     lunging=amber, groundwork=sky, hack=violet).
//   * Empty state has a real CTA + tone, not a placeholder string.

import Link from "next/link";
import type { SessionWithLabels } from "@/services/sessions";
import { DeleteSessionButton } from "./delete-session-button";

const TYPE_LABEL: Record<string, string> = {
  flat: "Flat",
  jumping: "Jumping",
  lunging: "Lunging",
  groundwork: "Groundwork",
  hack: "Hack",
  other: "Other",
};

const TYPE_TONE: Record<string, string> = {
  flat:       "bg-brand-50 text-brand-700",
  jumping:    "bg-emerald-50 text-emerald-700",
  lunging:    "bg-amber-50 text-amber-700",
  groundwork: "bg-sky-50 text-sky-700",
  hack:       "bg-violet-50 text-violet-700",
  other:      "bg-ink-100 text-ink-700",
};

export function SessionList({
  sessions,
  canDelete = false,
}: {
  sessions: SessionWithLabels[];
  /** Show the delete button on each row. Staff only. */
  canDelete?: boolean;
}) {
  if (sessions.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-soft px-6 py-10 text-center">
        <p className="text-sm font-semibold text-navy-900">No sessions yet</p>
        <p className="text-[12.5px] text-ink-500 mt-1.5 max-w-sm mx-auto">
          Every ride logged builds your horse&apos;s story and your training
          arc. Log one above — the next will be one tap.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {sessions.map((s) => (
        <li
          key={s.id}
          className="bg-white rounded-2xl shadow-soft px-4 py-3 md:px-5 md:py-4 flex flex-col md:flex-row md:items-center gap-3"
        >
          <div className="flex items-baseline gap-3 md:w-28 shrink-0">
            <span className="text-sm font-semibold tabular-nums text-navy-900">
              {formatRelative(s.started_at)}
            </span>
            <span className="text-[11px] text-ink-500 tabular-nums hidden md:inline">
              {formatTime(s.started_at)}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              {s.horse ? (
                <Link
                  href={`/dashboard/horses/${s.horse.id}`}
                  className="text-sm font-semibold text-navy-900 hover:text-brand-700 truncate"
                >
                  {s.horse.name}
                </Link>
              ) : (
                <span className="text-sm font-semibold text-ink-500">Unknown horse</span>
              )}
              <span className="text-ink-300">·</span>
              <span className="text-sm text-ink-700 truncate">
                {s.rider_client?.full_name ?? s.rider_name_freeform ?? "—"}
              </span>
            </div>

            <div className="mt-1 flex items-center gap-2 flex-wrap text-[11.5px]">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md font-medium ${TYPE_TONE[s.type] ?? TYPE_TONE.other}`}
              >
                {TYPE_LABEL[s.type] ?? s.type}
              </span>
              <span className="tabular-nums text-ink-500">{s.duration_minutes} min</span>
              {s.rating != null && (
                <span aria-label={`Rated ${s.rating} of 5`} className="tabular-nums text-amber-600">
                  {"★".repeat(s.rating)}
                  <span className="text-ink-300">{"★".repeat(5 - s.rating)}</span>
                </span>
              )}
              {s.trainer?.full_name && (
                <span className="text-ink-500">by {s.trainer.full_name}</span>
              )}
            </div>

            {s.notes && (
              <p className="text-[12.5px] text-ink-700 mt-1.5 line-clamp-2 leading-relaxed">
                {s.notes}
              </p>
            )}
          </div>

          {canDelete && (
            <div className="md:ml-2 shrink-0">
              <DeleteSessionButton sessionId={s.id} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

// ---------- helpers -------------------------------------------------------
function formatRelative(iso: string): string {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const min = Math.round(ms / 60000);
  if (min < 1)        return "now";
  if (min < 60)       return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr  < 24)       return `${hr}h`;
  const day = Math.round(hr / 24);
  if (day < 7)        return `${day}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
