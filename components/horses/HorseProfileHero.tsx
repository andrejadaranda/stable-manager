// Sticky hero for the horse profile. Photo + name (serif) + status pill +
// owner badge + KPI strip + primary action.
//
// Server component — no interactivity needed. Sticks to the viewport top
// with a thin shadow once the user scrolls.

import Link from "next/link";
import type { HorseProfileSummary } from "@/services/horseProfile";
import { EditHorseButton } from "./edit-horse-dialog";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const fmtRelative = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 60)        return `${min} min ago`;
  if (min < 60 * 24)   return `${Math.round(min / 60)} h ago`;
  const days = Math.round(min / (60 * 24));
  if (days === 1)      return "Yesterday";
  if (days < 30)       return `${days} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const yearsBetween = (iso: string): number => {
  const dob = new Date(iso);
  const diff = Date.now() - dob.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
};

export function HorseProfileHero({ horse }: { horse: HorseProfileSummary }) {
  const ageLabel = horse.date_of_birth ? `${yearsBetween(horse.date_of_birth)} yrs` : null;
  const breedAndAge = [horse.breed, ageLabel].filter(Boolean).join(" · ");
  const initial = horse.name[0]?.toUpperCase() ?? "?";

  const weeklyPct = Math.min(
    100,
    Math.round((horse.week.lesson_count / Math.max(1, horse.weekly_lesson_limit)) * 100),
  );

  return (
    <header className="card-elevated p-5 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center gap-5">
        {/* Photo / fallback */}
        <div className="shrink-0">
          {horse.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={horse.photo_url}
              alt={horse.name}
              className="w-20 h-20 md:w-[88px] md:h-[88px] rounded-2xl object-cover ring-1 ring-white"
            />
          ) : (
            <div
              className="w-20 h-20 md:w-[88px] md:h-[88px] rounded-2xl flex items-center justify-center"
              style={{ background: "#F5DDCB" }}
              aria-hidden
            >
              <span
                className="text-3xl text-brand-700"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                {initial}
              </span>
            </div>
          )}
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1
              className="text-[28px] md:text-[32px] leading-none text-ink-900"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 500 }}
            >
              {horse.name}
            </h1>
            {breedAndAge && (
              <span className="text-[11px] tracking-[0.04em] uppercase text-ink-500">
                {breedAndAge}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            <StatusPill active={horse.active} />
            {horse.owner_client_id && horse.owner_client_name && (
              <Link
                href={`/dashboard/clients/${horse.owner_client_id}`}
                className="text-xs text-ink-500 hover:text-ink-900"
              >
                Owned by <span className="text-ink-700 font-medium">{horse.owner_client_name}</span>
              </Link>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <EditHorseButton horse={horseAsHorseRow(horse)} />
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-5">
        <Kpi
          label="This week"
          value={`${horse.week.lesson_count} lesson${horse.week.lesson_count === 1 ? "" : "s"}`}
        />
        <Kpi
          label="Workload"
          value={`${weeklyPct}% of cap`}
          tone={weeklyPct >= 100 ? "danger" : weeklyPct >= 80 ? "warning" : "default"}
        />
        <Kpi
          label="Last ridden"
          value={horse.week.last_session_at ? fmtRelative(horse.week.last_session_at) : "—"}
        />
        <Kpi
          label="Next lesson"
          value={horse.week.next_lesson_at ? fmtDate(horse.week.next_lesson_at) : "None scheduled"}
        />
      </div>
    </header>
  );
}

function StatusPill({ active }: { active: boolean }) {
  if (active) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-[11.5px] font-medium px-2.5 py-1 rounded-full"
        style={{ background: "#EDF1E5", color: "#3F5A1F" }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#5A7A3A" }} />
        Available
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11.5px] font-medium px-2.5 py-1 rounded-full"
      style={{ background: "#F1EFE8", color: "#5A4F49" }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#8A8079" }} />
      Inactive
    </span>
  );
}

type Tone = "default" | "warning" | "danger";
function Kpi({ label, value, tone = "default" }: { label: string; value: string; tone?: Tone }) {
  const valueColor =
    tone === "danger"  ? "text-rose-700"
    : tone === "warning" ? "text-amber-700"
    : "text-ink-900";
  return (
    <div className="bg-ink-50/60 rounded-xl px-3 py-2.5">
      <div className="text-[10.5px] tracking-[0.04em] uppercase text-ink-500">{label}</div>
      <div className={`text-[15px] md:text-[16px] font-medium mt-1 ${valueColor}`}>{value}</div>
    </div>
  );
}

// EditHorseButton expects the legacy HorseRow type; the summary is a
// superset so we just downcast for the call.
function horseAsHorseRow(h: HorseProfileSummary) {
  return {
    id: h.id,
    stable_id: h.stable_id,
    name: h.name,
    breed: h.breed,
    date_of_birth: h.date_of_birth,
    daily_lesson_limit: h.daily_lesson_limit,
    weekly_lesson_limit: h.weekly_lesson_limit,
    active: h.active,
    notes: h.notes,
    created_at: "",
    updated_at: "",
  };
}
