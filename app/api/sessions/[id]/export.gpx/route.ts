// GET /api/sessions/:id/export.gpx
//
// Sprint 4 "Equilab killer" #3 — close the GPX-export gap. Equilab
// and Horse Riding Tracker both expose GPX so power-users can replay
// in Garmin Connect, Strava, RideWithGPS, etc. We do too now.
//
// Auth: thin — relies on the user's session cookie. RLS scopes the
// session row + session_tracks rows; anyone without access gets 404.
//
// Output format: GPX 1.1 (Topografix schema). One <trk> per session
// with a single <trkseg>. Each <trkpt> carries lat/lng + <ele> +
// <time>. If track points were never persisted (e.g. manually-logged
// session, or a finalize that pruned points) we still emit a valid
// GPX file with an empty trkseg — clients gracefully handle that.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  if (!UUID_RE.test(params.id)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const supabase = createSupabaseServerClient();

  // Pull session metadata first — RLS narrows to rows the caller can see.
  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select(`
      id, type, started_at, finished_at, distance_m, elapsed_seconds,
      horse:horses(name),
      trainer:profiles!sessions_trainer_id_fkey(full_name)
    `)
    .eq("id", params.id)
    .maybeSingle();

  if (sErr || !session) {
    return new NextResponse("Not found", { status: 404 });
  }

  const s = session as unknown as {
    id: string;
    type: string;
    started_at: string;
    finished_at: string | null;
    distance_m: number | null;
    elapsed_seconds: number | null;
    horse: { name: string } | null;
    trainer: { full_name: string | null } | null;
  };

  // Raw waypoints — ordered by capture time. Same RLS as session row.
  const { data: tracks } = await supabase
    .from("session_tracks")
    .select("lat, lng, altitude_m, recorded_at")
    .eq("session_id", params.id)
    .order("recorded_at", { ascending: true });

  const trkpts = (tracks ?? []) as Array<{
    lat: number;
    lng: number;
    altitude_m: number | null;
    recorded_at: string;
  }>;

  const trackName = [
    s.horse?.name ?? "Ride",
    new Date(s.started_at).toISOString().slice(0, 10),
  ].join(" — ");

  const xml = buildGpx({
    name: trackName,
    description: `Type: ${s.type}. Duration: ${s.elapsed_seconds ?? 0}s. Distance: ${s.distance_m ?? 0}m. Trainer: ${s.trainer?.full_name ?? "—"}.`,
    startedAt: s.started_at,
    points: trkpts.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      ele: p.altitude_m,
      time: p.recorded_at,
    })),
  });

  // Stable, browser-friendly filename: horse-yyyy-mm-dd.gpx
  const dateStr = new Date(s.started_at).toISOString().slice(0, 10);
  const slug = (s.horse?.name ?? "ride")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "ride";
  const filename = `longrein-${slug}-${dateStr}.gpx`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "content-type": "application/gpx+xml; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, max-age=300",
    },
  });
}

// ---- helpers ---------------------------------------------------

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildGpx(opts: {
  name: string;
  description: string;
  startedAt: string;
  points: Array<{ lat: number; lng: number; ele: number | null; time: string }>;
}): string {
  const head =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<gpx version="1.1" creator="Longrein (longrein.eu)" ' +
    'xmlns="http://www.topografix.com/GPX/1/1" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
    'xsi:schemaLocation="http://www.topografix.com/GPX/1/1 ' +
    'http://www.topografix.com/GPX/1/1/gpx.xsd">\n';

  const meta =
    "  <metadata>\n" +
    `    <name>${escapeXml(opts.name)}</name>\n` +
    `    <desc>${escapeXml(opts.description)}</desc>\n` +
    `    <time>${escapeXml(opts.startedAt)}</time>\n` +
    "  </metadata>\n";

  const trkptLines = opts.points
    .map((p) => {
      const lat = p.lat.toFixed(6);
      const lng = p.lng.toFixed(6);
      const inner: string[] = [];
      if (p.ele != null) inner.push(`<ele>${Number(p.ele).toFixed(1)}</ele>`);
      inner.push(`<time>${escapeXml(p.time)}</time>`);
      return `      <trkpt lat="${lat}" lon="${lng}">${inner.join("")}</trkpt>`;
    })
    .join("\n");

  const trk =
    "  <trk>\n" +
    `    <name>${escapeXml(opts.name)}</name>\n` +
    "    <trkseg>\n" +
    (trkptLines ? trkptLines + "\n" : "") +
    "    </trkseg>\n" +
    "  </trk>\n";

  return head + meta + trk + "</gpx>\n";
}
