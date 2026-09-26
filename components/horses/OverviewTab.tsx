// Overview tab — the "who is this horse" view. Server component, zero JS.
//
// Decluttered 2026-07-03: identity leads, and the heavy activity charts
// (12-week heatmap, training breakdown, recent-session list) were removed
// because they already live — richer — on the Sessions tab ("Training
// load"). Overview now shows identity + a single compact activity glance
// that links through to Sessions. Registry-style fields (microchip,
// passport, FEI, lineage) sit behind a "More details" disclosure so the
// common case stays clean.

import Link from "next/link";
import type { HorseProfileSummary } from "@/services/horseProfile";
import type { HorseCareVisit } from "@/services/farrierVisits.pure";

const SEX_LABEL: Record<string, string> = {
  mare: "Mare", gelding: "Gelding", stallion: "Stallion", colt: "Colt", filly: "Filly",
};

function ageFromDob(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const yrs = Math.floor((Date.now() - new Date(iso).getTime()) / (365.25 * 24 * 3600 * 1000));
  if (!Number.isFinite(yrs) || yrs < 0) return null;
  return `${yrs} yr${yrs === 1 ? "" : "s"}`;
}

function relTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return "just now";
  if (min < 60 * 24) return `${Math.round(min / 60)} h ago`;
  const d = Math.round(min / (60 * 24));
  if (d === 1) return "yesterday";
  if (d < 30) return `${d} d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function nextLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
    timeZone: "Europe/Vilnius",
  });
}

export function OverviewTab({ horse, careVisits = [] }: { horse: HorseProfileSummary; careVisits?: HorseCareVisit[] }) {
  return (
    <div className="flex flex-col gap-4">
      <IdentityCard horse={horse} />
      <CareGlance careVisits={careVisits} horseId={horse.id} />
      <ActivityGlance horse={horse} />
      {horse.notes && horse.notes.trim() !== "" && (
        <section className="bg-white rounded-2xl border border-ink-100 shadow-soft p-5">
          <h3 className="text-[10px] uppercase tracking-[0.14em] font-semibold text-neutral-500 mb-2">
            Notes
          </h3>
          <p className="text-sm text-ink-800 whitespace-pre-wrap leading-relaxed">{horse.notes}</p>
        </section>
      )}
    </div>
  );
}

/** At-a-glance "when was the farrier / vet last here" so the owner never has
 *  to scroll the calendar to find it. Farrier cycle heuristic: gently flag
 *  "due soon" past 6 weeks and "overdue" past 8 weeks since the last shoeing. */
function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 3600 * 1000));
}
function CareGlance({ careVisits, horseId }: { careVisits: HorseCareVisit[]; horseId: string }) {
  const lastFarrier = careVisits.find((v) => v.kind === "farrier") ?? null;
  const lastVet     = careVisits.find((v) => v.kind === "vet") ?? null;
  if (!lastFarrier && !lastVet) return null;

  const fd = lastFarrier ? daysSince(lastFarrier.starts_at) : null;
  const farrierFlag =
    fd == null ? null : fd >= 56 ? { label: "Overdue", cls: "text-alert-700 bg-alert-100" }
    : fd >= 42 ? { label: "Due soon", cls: "text-saddle-700 bg-saddle-100" }
    : null;

  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Vilnius" });

  return (
    <Link
      href={`/dashboard/horses/${horseId}?tab=health`}
      className="block bg-white rounded-2xl border border-ink-100 shadow-soft p-5 hover:border-brand-200 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] uppercase tracking-[0.14em] font-semibold text-neutral-500">Care</h3>
        <span className="text-[11px] text-brand-700 font-medium">Open health ↗</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface-muted/60 p-3.5">
          <p className="text-[11px] uppercase tracking-wide text-ink-400 font-semibold mb-1">Last farrier</p>
          {lastFarrier ? (
            <>
              <p className="text-[15px] font-semibold text-ink-900">{fmt(lastFarrier.starts_at)}</p>
              <p className="text-[12px] text-ink-500 mt-0.5">
                {fd} day{fd === 1 ? "" : "s"} ago{lastFarrier.farrier_name ? ` · ${lastFarrier.farrier_name}` : ""}
              </p>
              {farrierFlag && (
                <span className={`inline-block mt-2 text-[10px] font-bold uppercase tracking-[0.06em] px-2 py-1 rounded-full ${farrierFlag.cls}`}>
                  {farrierFlag.label}
                </span>
              )}
            </>
          ) : (
            <p className="text-[13px] text-ink-400 italic">No farrier visit yet</p>
          )}
        </div>
        <div className="rounded-xl bg-surface-muted/60 p-3.5">
          <p className="text-[11px] uppercase tracking-wide text-ink-400 font-semibold mb-1">Last vet</p>
          {lastVet ? (
            <>
              <p className="text-[15px] font-semibold text-ink-900">{fmt(lastVet.starts_at)}</p>
              <p className="text-[12px] text-ink-500 mt-0.5">
                {daysSince(lastVet.starts_at)} days ago{lastVet.farrier_name ? ` · ${lastVet.farrier_name}` : ""}
              </p>
            </>
          ) : (
            <p className="text-[13px] text-ink-400 italic">No vet visit yet</p>
          )}
        </div>
      </div>
    </Link>
  );
}

// ---------- Identity ------------------------------------------------
function IdentityCard({ horse }: { horse: HorseProfileSummary }) {
  const h = horse as HorseProfileSummary & {
    sex?: string | null; color?: string | null; height_cm?: number | null;
    discipline?: string | null; microchip_id?: string | null; passport_no?: string | null;
    fei_id?: string | null; sire_name?: string | null; dam_name?: string | null;
    unique_number?: string | null; date_of_birth?: string | null; breed?: string | null;
  };

  // The everyday fields — always shown when set.
  const primary: Array<[string, string | null | undefined]> = [
    ["Breed",      h.breed],
    ["Age",        ageFromDob(h.date_of_birth)],
    ["Sex",        h.sex ? (SEX_LABEL[h.sex] ?? h.sex) : null],
    ["Height",     h.height_cm != null ? `${h.height_cm} cm` : null],
    ["Colour",     h.color],
    ["Discipline", h.discipline],
  ].filter(([, v]) => v != null && String(v).trim() !== "") as Array<[string, string]>;

  // Registry / paperwork — tucked behind a disclosure.
  const secondary: Array<[string, string | null | undefined]> = [
    ["Microchip",  h.microchip_id],
    ["Passport",   h.passport_no],
    ["FEI ID",     h.fei_id],
    ["Sire",       h.sire_name],
    ["Dam",        h.dam_name],
    ["Stable ID",  h.unique_number],
  ].filter(([, v]) => v != null && String(v).trim() !== "") as Array<[string, string]>;

  if (primary.length === 0 && secondary.length === 0) {
    return (
      <section className="bg-white rounded-2xl border border-ink-100 shadow-soft p-5">
        <h3 className="text-[10px] uppercase tracking-[0.14em] font-semibold text-neutral-500 mb-2">
          Identity
        </h3>
        <p className="text-sm text-ink-500">
          No details yet — use <span className="font-medium text-ink-700">Edit</span> to add breed,
          age, height and paperwork.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-2xl border border-ink-100 shadow-soft p-5">
      <h3 className="text-[10px] uppercase tracking-[0.14em] font-semibold text-neutral-500 mb-3">
        Identity
      </h3>
      {primary.length > 0 && (
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-sm">
          {primary.map(([label, val]) => (
            <div key={label} className="flex flex-col gap-0.5 min-w-0">
              <dt className="text-[11px] uppercase tracking-wider text-ink-500 font-medium">{label}</dt>
              <dd className="text-ink-900 font-medium truncate" title={String(val)}>{String(val)}</dd>
            </div>
          ))}
        </dl>
      )}

      {secondary.length > 0 && (
        <details className="mt-4 group">
          <summary className="cursor-pointer list-none inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-600 hover:text-ink-900 select-none">
            <span className="transition-transform group-open:rotate-90 text-ink-400">›</span>
            More details ({secondary.length})
          </summary>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-sm mt-3 pt-3 border-t border-ink-100">
            {secondary.map(([label, val]) => (
              <div key={label} className="flex flex-col gap-0.5 min-w-0">
                <dt className="text-[11px] uppercase tracking-wider text-ink-500 font-medium">{label}</dt>
                <dd className="text-ink-900 font-medium truncate" title={String(val)}>{String(val)}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </section>
  );
}

// ---------- Activity glance (one line, links to Sessions) -----------
function ActivityGlance({ horse }: { horse: HorseProfileSummary }) {
  const week = horse.week;
  const cap = Math.max(1, horse.weekly_lesson_limit);
  const used = week.lesson_count;
  const pct = Math.min(1, used / cap);
  const barColor = pct >= 1 ? "#B23838" : pct >= 0.8 ? "#C2841A" : "#5A7A3A";
  const last = relTime(week.last_session_at);
  const next = nextLabel(week.next_lesson_at);

  return (
    <section className="bg-white rounded-2xl border border-ink-100 shadow-soft p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[10px] uppercase tracking-[0.14em] font-semibold text-neutral-500">
          Activity
        </h3>
        <Link
          href={`/dashboard/horses/${horse.id}?tab=sessions`}
          className="text-[12px] font-medium text-brand-700 hover:text-brand-800"
        >
          See all sessions →
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] uppercase tracking-wider text-ink-500 font-medium">This week</span>
          <span className="text-lg font-display text-navy-900 tabular-nums leading-none">
            {used}<span className="text-ink-400 text-sm">/{cap}</span>
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] uppercase tracking-wider text-ink-500 font-medium">Last ridden</span>
          <span className="text-sm font-medium text-ink-900 leading-tight">{last ?? "—"}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] uppercase tracking-wider text-ink-500 font-medium">Next lesson</span>
          <span className="text-sm font-medium text-ink-900 leading-tight">{next ?? "None"}</span>
        </div>
      </div>

      <div className="mt-3 h-1.5 rounded-full bg-ink-100 overflow-hidden" aria-hidden>
        <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: barColor }} />
      </div>
    </section>
  );
}
