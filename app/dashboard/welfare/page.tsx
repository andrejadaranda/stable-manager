// /dashboard/welfare — single-screen workload status for every horse.
//
// This is Hoofbeat's wedge: every other stable software treats welfare
// as a footnote on a horse profile. Here it's a top-level dashboard.
// Owner sees at-risk horses first (over cap → near cap → resting), with
// a 5-bucket counter strip across the top. Filter chips narrow the
// view to "At risk only" / "Resting" / "All".

import Link from "next/link";
import { requirePageRole } from "@/lib/auth/redirects";
import { getWelfareSnapshot, type WelfareState, type HorseWelfareCard } from "@/services/welfare";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATE_LABEL: Record<WelfareState, string> = {
  over_cap: "Over cap",
  near_cap: "Near cap",
  resting:  "Resting",
  steady:   "Steady",
  light:    "Light",
};

const STATE_TONE: Record<WelfareState, { bg: string; chip: string; dot: string; text: string }> = {
  over_cap: { bg: "bg-rose-50",    chip: "bg-rose-100 text-rose-800",      dot: "bg-rose-500",    text: "text-rose-800"    },
  near_cap: { bg: "bg-amber-50",   chip: "bg-amber-100 text-amber-800",    dot: "bg-amber-500",   text: "text-amber-800"   },
  resting:  { bg: "bg-sky-50",     chip: "bg-sky-100 text-sky-800",        dot: "bg-sky-500",     text: "text-sky-800"     },
  steady:   { bg: "bg-emerald-50", chip: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500", text: "text-emerald-800" },
  light:    { bg: "bg-emerald-50", chip: "bg-emerald-50 text-emerald-700",  dot: "bg-emerald-300", text: "text-emerald-700" },
};

const STATE_BLURB: Record<WelfareState, string> = {
  over_cap: "At weekly limit — booking blocked unless overridden with a reason.",
  near_cap: "Approaching weekly limit. Plan rest before the cap is hit.",
  resting:  "Hasn't ridden in 7+ days. Healthy if planned, flag if not.",
  steady:   "Comfortably worked, well within weekly limit.",
  light:    "Capacity for more lessons this week.",
};

type Filter = "all" | "at_risk" | "resting" | "available";

export default async function WelfarePage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  await requirePageRole("owner", "employee");
  const snapshot = await getWelfareSnapshot();

  const filter: Filter =
    searchParams.filter === "at_risk"   ? "at_risk"   :
    searchParams.filter === "resting"   ? "resting"   :
    searchParams.filter === "available" ? "available" :
    "all";

  const filtered = snapshot.horses.filter((h) => {
    if (filter === "at_risk")   return h.state === "over_cap" || h.state === "near_cap";
    if (filter === "resting")   return h.state === "resting";
    if (filter === "available") return h.state === "steady"   || h.state === "light";
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Welfare"
        subtitle={`Workload status across every horse · week of ${snapshot.weekLabel}`}
      />

      {/* Bucket counter strip — clickable filter chips */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        <BucketTile
          label="At risk"
          count={snapshot.byState.over_cap + snapshot.byState.near_cap}
          tone="rose"
          href="/dashboard/welfare?filter=at_risk"
          active={filter === "at_risk"}
        />
        <BucketTile
          label="Resting"
          count={snapshot.byState.resting}
          tone="sky"
          href="/dashboard/welfare?filter=resting"
          active={filter === "resting"}
        />
        <BucketTile
          label="Steady"
          count={snapshot.byState.steady}
          tone="emerald"
          href="/dashboard/welfare?filter=available"
          active={filter === "available"}
        />
        <BucketTile
          label="Light"
          count={snapshot.byState.light}
          tone="emerald-light"
          href="/dashboard/welfare?filter=available"
          active={filter === "available"}
        />
        <BucketTile
          label="All horses"
          count={snapshot.totalHorses}
          tone="navy"
          href="/dashboard/welfare"
          active={filter === "all"}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-soft px-6 py-12 text-center">
          <p className="text-sm font-semibold text-navy-900">
            No horses match this filter
          </p>
          <p className="text-[12.5px] text-ink-500 mt-1.5">
            {filter === "at_risk"
              ? "Nice — nothing's at risk right now. Keep an eye as the week progresses."
              : "Try a different filter or add more horses."}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((h) => (
            <li key={h.id}>
              <HorseWelfareTile horse={h} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BucketTile({
  label,
  count,
  tone,
  href,
  active,
}: {
  label: string;
  count: number;
  tone:  "rose" | "amber" | "sky" | "emerald" | "emerald-light" | "navy";
  href:  string;
  active: boolean;
}) {
  const palette = {
    "rose":          { bg: "bg-rose-50",    text: "text-rose-800",    ring: "ring-rose-300" },
    "amber":         { bg: "bg-amber-50",   text: "text-amber-800",   ring: "ring-amber-300" },
    "sky":           { bg: "bg-sky-50",     text: "text-sky-800",     ring: "ring-sky-300" },
    "emerald":       { bg: "bg-emerald-50", text: "text-emerald-800", ring: "ring-emerald-300" },
    "emerald-light": { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" },
    "navy":          { bg: "bg-navy-50",    text: "text-navy-900",    ring: "ring-navy-300" },
  }[tone];

  return (
    <Link
      href={href}
      className={`
        ${palette.bg} rounded-2xl px-4 py-3 transition-all
        ${active ? `ring-2 ${palette.ring}` : "hover:shadow-soft"}
      `}
    >
      <div className={`text-[10.5px] uppercase tracking-[0.08em] font-semibold ${palette.text} opacity-70`}>
        {label}
      </div>
      <div
        className={`mt-1 text-3xl tabular-nums ${palette.text}`}
        style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 500 }}
      >
        {count}
      </div>
    </Link>
  );
}

function HorseWelfareTile({ horse }: { horse: HorseWelfareCard }) {
  const tone = STATE_TONE[horse.state];
  const initial = horse.name[0]?.toUpperCase() ?? "?";

  return (
    <Link
      href={`/dashboard/horses/${horse.id}`}
      className="block bg-white rounded-2xl shadow-soft hover:shadow-lift transition-shadow overflow-hidden"
    >
      <div className={`${tone.bg} px-4 py-3 flex items-center gap-3`}>
        <span
          className="w-10 h-10 rounded-xl shrink-0 inline-flex items-center justify-center"
          style={{ background: "#F5DDCB" }}
          aria-hidden
        >
          <span className="text-brand-700 text-lg font-semibold" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
            {initial}
          </span>
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-navy-900 truncate">{horse.name}</p>
          <p className={`text-[11px] font-medium ${tone.text}`}>
            {STATE_LABEL[horse.state]} · {horse.weekly_count}/{horse.weekly_lesson_limit}
          </p>
        </div>
      </div>

      {/* Load bar */}
      <div className="px-4 pt-3">
        <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
          <div
            className={`h-full ${tone.dot} transition-all`}
            style={{ width: `${horse.load_pct}%` }}
          />
        </div>
        <div className="flex items-baseline justify-between mt-1.5">
          <span className="text-[11px] text-ink-500 tabular-nums">{horse.load_pct}% of weekly cap</span>
          <span className="text-[11px] text-ink-500 tabular-nums">{horse.weekly_minutes}m saddled</span>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-ink-100 mt-3 flex items-center justify-between">
        <span className="text-[11px] text-ink-500">
          {horse.days_since_last == null
            ? "Never ridden"
            : horse.days_since_last === 0
              ? "Ridden today"
              : horse.days_since_last === 1
                ? "Yesterday"
                : `${horse.days_since_last} d ago`}
        </span>
        <span className="text-[11px] text-brand-700 font-medium">View →</span>
      </div>

      {/* State blurb on hover */}
      <p className="px-4 pb-3 text-[10.5px] text-ink-500 leading-relaxed sr-only md:not-sr-only">
        {STATE_BLURB[horse.state]}
      </p>
    </Link>
  );
}
