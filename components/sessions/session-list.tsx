// Server component — renders a feed of sessions. No state, no interactivity
// beyond a delete form per row. Built to be fast on both desktop and mobile.

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

export function SessionList({ sessions }: { sessions: SessionWithLabels[] }) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl bg-surface-muted px-6 py-10 text-center text-ink-600 text-sm">
        No sessions yet. Log your first one above.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-ink-100 rounded-2xl bg-surface shadow-soft overflow-hidden">
      {sessions.map((s) => (
        <li
          key={s.id}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-4 py-3 md:px-5 md:py-4"
        >
          <div className="flex flex-1 items-center gap-3 min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-wider text-ink-500 w-16 shrink-0">
              {formatRelative(s.started_at)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-ink-900 truncate">
                {s.horse ? (
                  <Link
                    href={`/dashboard/horses/${s.horse.id}`}
                    className="font-medium text-ink-900 hover:text-brand-600"
                  >
                    {s.horse.name}
                  </Link>
                ) : (
                  <span className="font-medium text-ink-500">Unknown horse</span>
                )}
                <span className="text-ink-500"> · </span>
                <span className="text-ink-700">
                  {s.rider_client?.full_name ??
                    s.rider_name_freeform ??
                    "—"}
                </span>
              </div>
              <div className="text-xs text-ink-500 mt-0.5">
                {TYPE_LABEL[s.type] ?? s.type} · {s.duration_minutes} min
                {s.rating != null && (
                  <>
                    <span> · </span>
                    <span aria-label={`Rated ${s.rating} of 5`}>
                      {"★".repeat(s.rating)}
                      <span className="text-ink-300">{"★".repeat(5 - s.rating)}</span>
                    </span>
                  </>
                )}
                {s.trainer?.full_name && (
                  <>
                    <span> · by </span>
                    <span>{s.trainer.full_name}</span>
                  </>
                )}
              </div>
              {s.notes && (
                <p className="text-sm text-ink-700 mt-1 line-clamp-2">{s.notes}</p>
              )}
            </div>
          </div>
          <div className="md:ml-4 flex shrink-0 items-center justify-end">
            <DeleteSessionButton sessionId={s.id} />
          </div>
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
