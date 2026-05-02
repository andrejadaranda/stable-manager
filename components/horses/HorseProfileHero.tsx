// Horse profile hero — premium magazine-style header.
//
// Refresh (2026-04-30):
//   * Gradient banner (paddock green + warm cream) instead of plain card.
//   * Floating photo overlapping the banner like a profile avatar.
//   * Name in serif XL with subtle tracking.
//   * Status + welfare + owner pills clustered under name.
//   * KPI strip becomes 4-up tiles with bigger numbers (display font),
//     each with a soft brand-tone background instead of grey.
//   * Mobile: photo centers above name, full-width tiles 2x2.

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
    <header className="relative bg-white rounded-3xl shadow-soft overflow-hidden">
      {/* Gradient banner */}
      <div
        className="h-32 md:h-36 w-full"
        style={{
          background:
            "linear-gradient(135deg, #1E3A2A 0%, #2D5440 45%, #5C7C5F 80%, #C8B89A 100%)",
        }}
        aria-hidden
      >
        {/* Subtle pattern overlay */}
        <div
          className="w-full h-full opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 30%, white 1px, transparent 1px)",
            backgroundSize: "32px 32px, 26px 26px",
          }}
        />
      </div>

      <div className="px-5 md:px-7 pb-5 md:pb-6">
        <div className="flex flex-col md:flex-row md:items-end md:gap-6 -mt-12 md:-mt-14">
          {/* Photo */}
          <div className="shrink-0 self-center md:self-end">
            {horse.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={horse.photo_url}
                alt={horse.name}
                className="w-28 h-28 md:w-32 md:h-32 rounded-3xl object-cover ring-4 ring-white shadow-soft"
              />
            ) : (
              <div
                className="w-28 h-28 md:w-32 md:h-32 rounded-3xl flex items-center justify-center ring-4 ring-white shadow-soft"
                style={{ background: "#F5DDCB" }}
                aria-hidden
              >
                <span
                  className="text-5xl text-brand-700"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                >
                  {initial}
                </span>
              </div>
            )}
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0 mt-3 md:mt-0 md:pb-1 text-center md:text-left">
            <h1
              className="text-3xl md:text-[36px] leading-none text-ink-900"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 500, letterSpacing: "-0.01em" }}
            >
              {horse.name}
            </h1>
            {breedAndAge && (
              <p className="text-[11px] tracking-[0.08em] uppercase text-ink-500 mt-2">
                {breedAndAge}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0 mt-3 md:mt-0 self-center md:self-end md:pb-1">
            <EditHorseButton horse={horseAsHorseRow(horse)} />
          </div>
        </div>

        {/* Pills row */}
        <div className="flex flex-wrap items-center gap-2 mt-4 justify-center md:justify-start">
          <StatusPill active={horse.active} />
          <WelfarePill
            weekCount={horse.week.lesson_count}
            weeklyLimit={horse.weekly_lesson_limit}
          />
          {horse.owner_client_id && horse.owner_client_name && (
            <Link
              href={`/dashboard/clients/${horse.owner_client_id}`}
              className="text-[11.5px] text-ink-500 hover:text-ink-900 inline-flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-ink-100/60 transition-colors"
            >
              Owned by <span className="text-ink-700 font-medium">{horse.owner_client_name}</span>
            </Link>
          )}
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mt-5">
          <Kpi
            label="This week"
            value={String(horse.week.lesson_count)}
            sub={horse.week.lesson_count === 1 ? "lesson" : "lessons"}
            color="brand"
          />
          <Kpi
            label="Workload"
            value={`${weeklyPct}%`}
            sub="of weekly cap"
            color={weeklyPct >= 100 ? "danger" : weeklyPct >= 80 ? "warning" : "ok"}
          />
          <Kpi
            label="Last ridden"
            value={horse.week.last_session_at ? fmtRelative(horse.week.last_session_at) : "—"}
            sub={horse.week.last_session_at ? "" : "no rides logged"}
            color="navy"
          />
          <Kpi
            label="Next lesson"
            value={horse.week.next_lesson_at ? fmtDate(horse.week.next_lesson_at) : "None"}
            sub={horse.week.next_lesson_at ? "" : "schedule one"}
            color="navy"
          />
        </div>
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

function WelfarePill({
  weekCount,
  weeklyLimit,
}: {
  weekCount: number;
  weeklyLimit: number;
}) {
  if (weeklyLimit <= 0) return null;
  const ratio = weekCount / weeklyLimit;

  let label: string;
  let cls: string;
  if (ratio >= 1) {
    label = `Over cap · ${weekCount}/${weeklyLimit}`;
    cls = "bg-rose-100 text-rose-800";
  } else if (ratio >= 0.85) {
    label = `Near cap · ${weekCount}/${weeklyLimit}`;
    cls = "bg-amber-100 text-amber-800";
  } else if (ratio >= 0.5) {
    label = `Steady · ${weekCount}/${weeklyLimit}`;
    cls = "bg-emerald-100 text-emerald-800";
  } else {
    label = `Light · ${weekCount}/${weeklyLimit}`;
    cls = "bg-emerald-50 text-emerald-700";
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold tracking-[0.02em] ${cls}`}
      title="Weekly lesson load vs cap. The cap blocks new bookings unless a welfare-override reason is supplied."
    >
      {label}
    </span>
  );
}

type KpiColor = "brand" | "navy" | "warning" | "danger" | "ok";
function Kpi({
  label,
  value,
  sub,
  color = "brand",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: KpiColor;
}) {
  const palette: Record<KpiColor, { bg: string; value: string; label: string }> = {
    brand:   { bg: "bg-brand-50",    value: "text-brand-700",   label: "text-brand-700/70"   },
    navy:    { bg: "bg-navy-50",     value: "text-navy-900",    label: "text-ink-500"        },
    ok:      { bg: "bg-emerald-50",  value: "text-emerald-800", label: "text-emerald-700/80" },
    warning: { bg: "bg-amber-50",    value: "text-amber-800",   label: "text-amber-700/80"   },
    danger:  { bg: "bg-rose-50",     value: "text-rose-800",    label: "text-rose-700/80"    },
  };
  const c = palette[color];
  return (
    <div className={`${c.bg} rounded-2xl px-4 py-3`}>
      <div className={`text-[10.5px] tracking-[0.08em] uppercase font-semibold ${c.label}`}>
        {label}
      </div>
      <div
        className={`mt-1.5 text-2xl md:text-[26px] leading-none ${c.value} tabular-nums`}
        style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 500 }}
      >
        {value}
      </div>
      {sub && (
        <div className={`text-[11px] ${c.label} mt-1`}>{sub}</div>
      )}
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
    owner_client_id: h.owner_client_id,
    available_for_lessons: h.available_for_lessons,
    public_bio: h.public_bio,
    backup_contact_name:     null,
    backup_contact_phone:    null,
    backup_contact_relation: null,
    created_at: "",
    updated_at: "",
  };
}
