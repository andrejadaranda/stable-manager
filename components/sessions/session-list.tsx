// Server component — Strava/Equilab-style feed of ride sessions.
//
// Each ride is a card: horse avatar + name + when/by + type chip, a route
// map thumbnail decoded from the stored Google-encoded polyline (or an
// "indoor · no GPS" placeholder), a distance/duration/avg stat row, an
// optional gait breakdown bar (walk/trot/canter) when tracked, and a footer.
// All GPS fields come back via `select("*")` in services/sessions.ts.

import Link from "next/link";
import type { SessionWithLabels } from "@/services/sessions";
import { EmptyState } from "@/components/ui";
import { DeleteSessionButton } from "./delete-session-button";

const TYPE_LABEL: Record<string, string> = {
  flat: "Flat", jumping: "Jumping", lunging: "Lunging",
  groundwork: "Groundwork", hack: "Hack", other: "Other",
};
const TYPE_TONE: Record<string, string> = {
  flat:       "bg-brand-50 text-brand-700",
  jumping:    "bg-emerald-50 text-emerald-700",
  lunging:    "bg-amber-50 text-amber-700",
  groundwork: "bg-sky-50 text-sky-700",
  hack:       "bg-violet-50 text-violet-700",
  other:      "bg-ink-100 text-ink-700",
};
const AVA_TONE: Record<string, string> = {
  hack:    "bg-violet-100 text-violet-700",
  jumping: "bg-emerald-100 text-emerald-700",
  flat:    "bg-brand-100 text-brand-700",
  lunging: "bg-amber-100 text-amber-700",
  groundwork: "bg-sky-100 text-sky-700",
  other:   "bg-saddle-100 text-saddle-700",
};

type GpsSession = SessionWithLabels & {
  distance_m?: number | null;
  avg_speed_kmh?: number | null;
  elapsed_seconds?: number | null;
  encoded_polyline?: string | null;
  gait_breakdown?: Record<string, number> | null;
};

export function SessionList({
  sessions,
  canDelete = false,
}: {
  sessions: SessionWithLabels[];
  canDelete?: boolean;
}) {
  if (sessions.length === 0) {
    return (
      <EmptyState
        title="No sessions yet"
        body="Every ride logged builds your horse's story and your training arc. Start a live GPS ride or log a past session."
        primary={{ label: "▶ Start live ride", href: "/dashboard/sessions/live" }}
        secondary={{ label: "Log past session", href: "/dashboard/sessions?new=1" }}
      />
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {sessions.map((raw) => {
        const s = raw as GpsSession;
        const type = s.type ?? "other";
        const distanceM = Number(s.distance_m ?? 0);
        const hasGps = Boolean(s.encoded_polyline && s.encoded_polyline.length >= 10);
        const route = hasGps ? polylineToSvg(s.encoded_polyline as string) : null;
        const durationSec = Number(s.elapsed_seconds ?? 0) || (s.duration_minutes ?? 0) * 60;
        const gaits = normaliseGaits(s.gait_breakdown);

        return (
          <li key={s.id} className="bg-white border border-ink-100 rounded-[22px] shadow-soft overflow-hidden">
            {/* head */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
              <span className={`w-11 h-11 rounded-[14px] shrink-0 inline-flex items-center justify-center text-base font-bold ${AVA_TONE[type] ?? AVA_TONE.other}`}>
                {(s.horse?.name?.[0] ?? "?").toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[16px] font-bold text-ink-900 truncate">
                  {s.horse?.name ?? "Unknown horse"}
                </div>
                <div className="text-[13px] text-ink-500 truncate">
                  {formatRelative(s.started_at)}
                  {s.trainer?.full_name ? ` · by ${s.trainer.full_name}` : ""}
                </div>
              </div>
              <span className={`shrink-0 text-[11px] font-bold uppercase tracking-[0.06em] px-2.5 py-1.5 rounded-full ${TYPE_TONE[type] ?? TYPE_TONE.other}`}>
                {TYPE_LABEL[type] ?? type}
              </span>
            </div>

            {/* map or arena placeholder */}
            {route ? (
              <div className="mx-4 rounded-2xl overflow-hidden border border-ink-100" style={{ background: "#e4ead8" }}>
                <svg viewBox="0 0 358 140" preserveAspectRatio="xMidYMid slice" className="w-full h-[130px] block">
                  <path d={route.d} fill="none" stroke="#1E3A2A" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx={route.start.x} cy={route.start.y} r="7" fill="#fff" stroke="#43825f" strokeWidth="4" />
                </svg>
              </div>
            ) : (
              <div className="mx-4 h-[92px] rounded-2xl bg-ink-50 border border-ink-100 flex flex-col items-center justify-center gap-1.5 text-ink-400">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></svg>
                <span className="text-[12px] font-medium">Indoor / arena · no GPS</span>
              </div>
            )}

            {/* stats */}
            <div className="grid grid-cols-3 gap-2 px-4 py-3.5">
              <Stat value={hasGps && distanceM > 0 ? (distanceM / 1000).toFixed(1) : "—"} unit={hasGps ? "km" : ""} label="Distance" />
              <Stat value={formatDuration(durationSec)} unit="" label="Duration" />
              <Stat value={s.avg_speed_kmh != null ? Number(s.avg_speed_kmh).toFixed(1) : "—"} unit={s.avg_speed_kmh != null ? "km/h" : ""} label="Avg" />
            </div>

            {/* gait breakdown (only when tracked) */}
            {gaits && (
              <div className="px-4 pb-3.5">
                <div className="h-2 rounded-full overflow-hidden flex bg-ink-100">
                  <span style={{ width: `${gaits.walkPct}%`, background: "#6ba384" }} />
                  <span style={{ width: `${gaits.trotPct}%`, background: "#c18c44" }} />
                  <span style={{ width: `${gaits.canterPct}%`, background: "#c15540" }} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[12px] text-ink-500">
                  <GaitLeg color="#6ba384" label="Walk" mins={gaits.walkMin} />
                  <GaitLeg color="#c18c44" label="Trot" mins={gaits.trotMin} />
                  <GaitLeg color="#c15540" label="Canter" mins={gaits.canterMin} />
                </div>
              </div>
            )}

            {/* footer */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-ink-100">
              <span className="inline-flex items-center gap-1.5 text-[12px] text-brand-600">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 6 9 17l-5-5" /></svg>
                {s.horse?.name ? `Added to ${s.horse.name}'s workload` : "Feeds welfare workload"}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/dashboard/sessions/${s.id}`}
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:text-brand-800"
                >
                  View
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
                </Link>
                {canDelete && <DeleteSessionButton sessionId={s.id} />}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Stat({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-mono font-semibold text-[19px] text-ink-900 tabular-nums leading-none">
        {value}<span className="text-[12px] text-ink-400 font-sans">{unit ? ` ${unit}` : ""}</span>
      </div>
      <div className="text-[11px] text-ink-400 font-medium mt-1.5 uppercase tracking-[0.06em]">{label}</div>
    </div>
  );
}

function GaitLeg({ color, label, mins }: { color: string; label: string; mins: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {label} <b className="text-ink-800 font-bold">{mins}m</b>
    </span>
  );
}

// ---------- helpers -------------------------------------------------------

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day === 1) return "yesterday";
  if (day < 7) return `${day} days ago`;
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric", timeZone: "Europe/Vilnius" });
}

function formatDuration(sec: number): string {
  if (!sec || sec <= 0) return "—";
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/** gait_breakdown jsonb → normalized minutes + percentages. Accepts seconds
 *  or minutes for walk/trot/canter; returns null when nothing is tracked. */
function normaliseGaits(g: Record<string, number> | null | undefined) {
  if (!g) return null;
  const walk = Number(g.walk ?? g.walk_seconds ?? 0);
  const trot = Number(g.trot ?? g.trot_seconds ?? 0);
  const canter = Number(g.canter ?? g.canter_seconds ?? 0);
  const total = walk + trot + canter;
  if (total <= 0) return null;
  // Heuristic: values >180 are almost certainly seconds.
  const toMin = (v: number) => (total > 180 ? Math.round(v / 60) : Math.round(v));
  return {
    walkPct: (walk / total) * 100,
    trotPct: (trot / total) * 100,
    canterPct: (canter / total) * 100,
    walkMin: toMin(walk),
    trotMin: toMin(trot),
    canterMin: toMin(canter),
  };
}

/** Decode a Google-encoded polyline and project it into a 358×140 viewBox. */
function polylineToSvg(encoded: string): { d: string; start: { x: number; y: number } } | null {
  const pts = decodePolyline(encoded);
  if (pts.length < 2) return null;
  const lats = pts.map((p) => p[0]);
  const lngs = pts.map((p) => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const W = 358, H = 140, pad = 16;
  const spanLat = maxLat - minLat || 1e-6;
  const spanLng = maxLng - minLng || 1e-6;
  // Preserve aspect a little by using the larger span as the scale ref.
  const project = (lat: number, lng: number) => {
    const x = pad + ((lng - minLng) / spanLng) * (W - 2 * pad);
    // invert lat so north is up
    const y = pad + (1 - (lat - minLat) / spanLat) * (H - 2 * pad);
    return [x, y] as const;
  };
  const [sx, sy] = project(pts[0][0], pts[0][1]);
  const d = pts
    .map((p, i) => {
      const [x, y] = project(p[0], p[1]);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return { d, start: { x: sx, y: sy } };
}

function decodePolyline(str: string): Array<[number, number]> {
  let index = 0, lat = 0, lng = 0;
  const out: Array<[number, number]> = [];
  while (index < str.length) {
    let result = 1, shift = 0, b: number;
    do { b = str.charCodeAt(index++) - 63 - 1; result += b << shift; shift += 5; } while (b >= 0x1f);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 1; shift = 0;
    do { b = str.charCodeAt(index++) - 63 - 1; result += b << shift; shift += 5; } while (b >= 0x1f);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    out.push([lat * 1e-5, lng * 1e-5]);
  }
  return out;
}
