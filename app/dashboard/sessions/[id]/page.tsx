// Session detail page — full Strava-style summary.
//
// Renders:
//   - Route map (Leaflet + OSM tiles)
//   - Headline stats (distance, time, avg/max speed)
//   - Gait breakdown (walk / trot / canter / gallop split)
//   - Notes + rating
//   - Edit / delete actions (existing pattern)

import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { SESSION_TYPE_LABEL, type SessionType } from "@/services/sessions.types";
import { SessionMap } from "@/components/sessions/SessionMap";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

type GaitBreakdown = {
  walk_s:   number;
  trot_s:   number;
  canter_s: number;
  gallop_s: number;
};

type SessionDetail = {
  id: string;
  stable_id: string;
  horse_id: string | null;
  status: "live" | "completed" | "abandoned" | null;
  type: SessionType;
  started_at: string;
  finished_at: string | null;
  duration_minutes: number;
  distance_m: number | null;
  elapsed_seconds: number | null;
  moving_seconds: number | null;
  avg_speed_kmh: number | null;
  max_speed_kmh: number | null;
  encoded_polyline: string | null;
  gait_breakdown: GaitBreakdown | null;
  tracking_points: number | null;
  notes: string | null;
  rating: number | null;
  horse: { id: string; name: string } | null;
};

// UUID-only — defense vs cast crashes (SEC-12 pattern).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SessionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  if (!UUID_RE.test(params.id)) notFound();

  await getSession();  // throws → middleware bounces to /login

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sessions")
    .select(`
      id, stable_id, horse_id, status, type, started_at, finished_at,
      duration_minutes, distance_m, elapsed_seconds, moving_seconds,
      avg_speed_kmh, max_speed_kmh, encoded_polyline, gait_breakdown,
      tracking_points, notes, rating,
      horse:horses(id, name)
    `)
    .eq("id", params.id)
    .maybeSingle();

  if (error || !data) notFound();
  const s = data as unknown as SessionDetail;

  const km = s.distance_m != null ? (s.distance_m / 1000).toFixed(2) : "—";
  const time = s.elapsed_seconds != null
    ? formatHMS(s.elapsed_seconds)
    : `${s.duration_minutes} min`;
  const avg = s.avg_speed_kmh != null ? `${s.avg_speed_kmh.toFixed(1)} km/h` : "—";
  const max = s.max_speed_kmh != null ? `${s.max_speed_kmh.toFixed(1)} km/h` : "—";

  const started = new Date(s.started_at);
  const finished = s.finished_at ? new Date(s.finished_at) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={s.horse?.name ? `${s.horse.name} · ${SESSION_TYPE_LABEL[s.type]}` : SESSION_TYPE_LABEL[s.type]}
        subtitle={`${started.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} · ${started.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}${finished ? ` → ${finished.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}`}
      />

      {/* Map */}
      <SessionMap encodedPolyline={s.encoded_polyline} />

      {/* Headline numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card label="Distance" value={`${km} km`} />
        <Card label="Time"     value={time} />
        <Card label="Avg"      value={avg} />
        <Card label="Max"      value={max} />
      </div>

      {/* Gait breakdown */}
      {s.gait_breakdown && (
        <section className="bg-white rounded-2xl border border-ink-100 p-5 shadow-soft">
          <h2 className="font-display text-lg text-navy-700 mb-4">Gait split</h2>
          <GaitBar g={s.gait_breakdown} />
        </section>
      )}

      {/* Notes */}
      {s.notes && (
        <section className="bg-white rounded-2xl border border-ink-100 p-5 shadow-soft">
          <h2 className="font-display text-lg text-navy-700 mb-2">Notes</h2>
          <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-wrap">{s.notes}</p>
        </section>
      )}

      {/* Meta */}
      <div className="text-xs text-ink-500 flex flex-wrap gap-x-4 gap-y-1">
        {s.tracking_points != null && <span>{s.tracking_points} GPS points</span>}
        {s.status === "live" && <span className="text-emerald-700 font-medium">● Live</span>}
        {s.status === "abandoned" && <span className="text-amber-700">Abandoned</span>}
        {s.rating && <span>★ {s.rating}/5</span>}
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl border border-ink-100 p-5 shadow-soft text-center">
      <div className="font-display text-2xl tabular-nums text-navy-700">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-ink-500 mt-1">{label}</div>
    </div>
  );
}

function GaitBar({ g }: { g: GaitBreakdown }) {
  const total = g.walk_s + g.trot_s + g.canter_s + g.gallop_s;
  if (total === 0) {
    return <p className="text-sm text-ink-500">No movement detected.</p>;
  }
  const pct = (n: number) => (n / total) * 100;
  const segments: Array<{ key: keyof GaitBreakdown; label: string; color: string; secs: number }> = [
    { key: "walk_s",   label: "Walk",   color: "#a3b18a", secs: g.walk_s },
    { key: "trot_s",   label: "Trot",   color: "#588157", secs: g.trot_s },
    { key: "canter_s", label: "Canter", color: "#B5793E", secs: g.canter_s },
    { key: "gallop_s", label: "Gallop", color: "#bc4749", secs: g.gallop_s },
  ];
  return (
    <div className="space-y-3">
      <div className="h-3 rounded-full overflow-hidden flex bg-ink-100">
        {segments.map((s) =>
          s.secs > 0 ? (
            <div
              key={s.key}
              style={{ width: `${pct(s.secs)}%`, backgroundColor: s.color }}
              title={`${s.label}: ${formatHMS(s.secs)}`}
            />
          ) : null,
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="text-ink-700">{s.label}</span>
            <span className="text-ink-500 tabular-nums ml-auto">{formatHMS(s.secs)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatHMS(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
