// GET /api/sessions/:id/share-card?format=story|post
//
// Returns a branded PNG of the ride suitable for IG Stories / posts /
// LinkedIn. Generated server-side via @vercel/og (built into Next 14)
// so it's edge-runtime fast and cacheable.
//
// Two formats:
//   story (default) — 1080×1920 (9:16 IG Story)
//   post            — 1080×1080 (1:1 IG Post)
//
// Auth: thin — we read via the user's session cookie. RLS narrows the
// row, so unauthorized callers get 404.
//
// Why edge: ImageResponse uses satori under the hood, which needs the
// Edge runtime. We render JSX, no headless browser.

import { ImageResponse } from "next/og";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { decodePolyline } from "@/services/sessionTracking.pure";
import { SESSION_TYPE_LABEL, type SessionType } from "@/services/sessions.types";

export const runtime = "edge";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  if (!UUID_RE.test(params.id)) {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "post" ? "post" : "story";
  const w = 1080;
  const h = format === "post" ? 1080 : 1920;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sessions")
    .select(`
      id, type, started_at, distance_m, elapsed_seconds, stable_id,
      avg_speed_kmh, max_speed_kmh, encoded_polyline, gait_breakdown,
      horse:horses(name),
      stable:stables(name, brand_color, logo_url)
    `)
    .eq("id", params.id)
    .maybeSingle();

  if (error || !data) {
    return new Response("Not found", { status: 404 });
  }

  type GaitBreakdown = { walk_s: number; trot_s: number; canter_s: number; gallop_s: number };
  const s = data as unknown as {
    type: SessionType;
    started_at: string;
    distance_m: number | null;
    elapsed_seconds: number | null;
    avg_speed_kmh: number | null;
    max_speed_kmh: number | null;
    encoded_polyline: string | null;
    gait_breakdown: GaitBreakdown | null;
    horse: { name: string } | null;
    stable: { name: string; brand_color: string | null; logo_url: string | null } | null;
  };

  // Brand kit — defaults to Longrein paddock-green + wordmark if stable
  // hasn't set their own.
  const brandColor = s.stable?.brand_color ?? "#1E3A2A";
  const stableName = s.stable?.name        ?? "Longrein";
  const logoUrl    = s.stable?.logo_url    ?? null;

  // Render the route as an SVG path normalised to the card's map area.
  const mapW = format === "post" ? 920 : 920;
  const mapH = format === "post" ? 460 : 880;
  const routeSvg = buildRouteSvg(s.encoded_polyline, mapW, mapH);

  const km = s.distance_m != null ? (s.distance_m / 1000).toFixed(2) : "—";
  const time = s.elapsed_seconds != null ? formatHMS(s.elapsed_seconds) : "—";
  const avg = s.avg_speed_kmh != null ? `${s.avg_speed_kmh.toFixed(1)}` : "—";
  const max = s.max_speed_kmh != null ? `${s.max_speed_kmh.toFixed(1)}` : "—";
  const dateStr = new Date(s.started_at).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
  const title = s.horse?.name
    ? `${s.horse.name}`
    : SESSION_TYPE_LABEL[s.type];
  const subtitle = s.horse?.name
    ? `${SESSION_TYPE_LABEL[s.type]} · ${dateStr}`
    : dateStr;

  const gait = s.gait_breakdown;

  return new ImageResponse(
    (
      <div
        style={{
          width: w,
          height: h,
          display: "flex",
          flexDirection: "column",
          background: "#F4ECDF",
          padding: "80px 80px 64px 80px",
          fontFamily: "serif",
          color: brandColor,
          position: "relative",
        }}
      >
        {/* Top row: stable brand LEFT + Longrein wordmark badge RIGHT.
            Both visible — stable owns the moment, Longrein gets the acquisition. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} width={56} height={56} alt="" style={{ borderRadius: 12, objectFit: "cover" }} />
            )}
            <span style={{ fontSize: 38, fontWeight: 600, letterSpacing: "-0.02em" }}>{stableName}</span>
          </div>
          {/* Longrein wordmark badge — pill with brand wordmark + saddle dot.
              Same visual recipe as our logo elsewhere, always paddock-green +
              saddle regardless of stable's chosen color so the wordmark is
              instantly recognizable. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "#1E3A2A",
              color: "#F4ECDF",
              padding: "10px 18px",
              borderRadius: 999,
            }}
          >
            <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>Longrein</span>
            <span style={{ fontSize: 22, color: "#B5793E" }}>.</span>
          </div>
        </div>

        {/* Title */}
        <div style={{ display: "flex", flexDirection: "column", marginBottom: 36 }}>
          <div style={{ fontSize: format === "post" ? 72 : 96, fontWeight: 600, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
            {title}
          </div>
          <div style={{ fontSize: 26, color: "#6E6760", marginTop: 12, fontFamily: "sans-serif" }}>
            {subtitle}
          </div>
        </div>

        {/* Map / route */}
        <div
          style={{
            display: "flex",
            background: "#FBF6EC",
            border: "1px solid #E5DCC8",
            borderRadius: 28,
            padding: 32,
            width: mapW + 64,
            height: mapH + 64,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 36,
          }}
        >
          {routeSvg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={routeSvg} width={mapW} height={mapH} alt="" />
          ) : (
            <div style={{ color: "#6E6760", fontSize: 28, fontFamily: "sans-serif" }}>
              No route data
            </div>
          )}
        </div>

        {/* Big stat row */}
        <div style={{ display: "flex", gap: 24, marginBottom: format === "post" ? 0 : 32 }}>
          <Stat label="Distance" value={`${km} km`} format={format} />
          <Stat label="Time"     value={time}        format={format} />
          <Stat label="Avg"      value={`${avg} km/h`} format={format} />
          <Stat label="Max"      value={`${max} km/h`} format={format} />
        </div>

        {/* Gait split bar — story only (post is too tight) */}
        {gait && format === "story" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
            <div style={{ fontSize: 18, color: "#6E6760", letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: "sans-serif", fontWeight: 600 }}>
              Gait split
            </div>
            <GaitBar g={gait} width={920} />
          </div>
        )}

        {/* Footer — second Longrein touchpoint with URL.
            Redundancy = harder to crop out, viewers always see where the
            app lives. */}
        <div
          style={{
            display: "flex",
            marginTop: "auto",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 20,
            borderTop: "1px solid rgba(110,103,96,0.2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", color: "#6E6760", fontSize: 20, fontFamily: "sans-serif" }}>
            Tracked with
            <span style={{ marginLeft: 8, fontFamily: "serif", color: "#1E3A2A", fontSize: 22, fontWeight: 600 }}>Longrein</span>
            <span style={{ color: "#B5793E", fontSize: 22, fontWeight: 600 }}>.</span>
          </div>
          <div style={{ display: "flex", color: "#1E3A2A", fontSize: 20, fontFamily: "sans-serif", fontWeight: 600 }}>
            longrein.eu
          </div>
        </div>
      </div>
    ),
    {
      width: w,
      height: h,
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=86400",
      },
    },
  );
}

function Stat({ label, value, format }: { label: string; value: string; format: "story" | "post" }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        background: "#FBF6EC",
        border: "1px solid #E5DCC8",
        borderRadius: 22,
        padding: "24px 20px",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ fontSize: format === "post" ? 38 : 48, fontWeight: 600, letterSpacing: "-0.01em", color: "#1E3A2A" }}>{value}</div>
      <div style={{ fontSize: 16, color: "#6E6760", letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 8, fontFamily: "sans-serif", fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function GaitBar({ g, width }: { g: { walk_s: number; trot_s: number; canter_s: number; gallop_s: number }; width: number }) {
  const total = g.walk_s + g.trot_s + g.canter_s + g.gallop_s;
  if (total === 0) return <div style={{ fontSize: 22, color: "#6E6760", fontFamily: "sans-serif" }}>No movement</div>;
  const pct = (n: number) => (n / total) * 100;
  const segs = [
    { color: "#a3b18a", n: g.walk_s,   label: "Walk" },
    { color: "#588157", n: g.trot_s,   label: "Trot" },
    { color: "#B5793E", n: g.canter_s, label: "Canter" },
    { color: "#bc4749", n: g.gallop_s, label: "Gallop" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, width }}>
      <div style={{ display: "flex", height: 22, borderRadius: 11, overflow: "hidden", width }}>
        {segs.map((s, i) => s.n > 0 ? (
          <div key={i} style={{ width: `${pct(s.n)}%`, background: s.color }} />
        ) : null)}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: "#1E3A2A", fontFamily: "sans-serif" }}>
        {segs.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 14, height: 14, background: s.color, borderRadius: 3, display: "flex" }} />
            <span>{s.label} {formatHMS(s.n)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatHMS(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Build a data:image/svg+xml URL with the route polyline auto-fit to (w,h).
// @vercel/og <img> accepts data URLs. We bake the SVG so satori doesn't
// have to parse complex paths from raw markup.
function buildRouteSvg(encoded: string | null, w: number, h: number): string | null {
  if (!encoded) return null;
  const pts = decodePolyline(encoded);
  if (pts.length === 0) return null;

  // Bounding box of the route.
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of pts) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  const dLat = Math.max(maxLat - minLat, 1e-9);
  const dLng = Math.max(maxLng - minLng, 1e-9);

  // Aspect-correct scale — equal degrees do NOT equal meters at high
  // latitudes, but for visual aesthetic at this size it's fine.
  const pad = 40;
  const sx = (w - pad * 2) / dLng;
  const sy = (h - pad * 2) / dLat;
  const scale = Math.min(sx, sy);
  const offX = (w - dLng * scale) / 2;
  const offY = (h - dLat * scale) / 2;

  const path = pts.map((p, i) => {
    const x = offX + (p.lng - minLng) * scale;
    // SVG y is inverted vs lat.
    const y = h - offY - (p.lat - minLat) * scale;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  // First + last point as circles.
  const first = pts[0];
  const last  = pts[pts.length - 1];
  const fx = offX + (first.lng - minLng) * scale;
  const fy = h - offY - (first.lat - minLat) * scale;
  const lx = offX + (last.lng - minLng)  * scale;
  const ly = h - offY - (last.lat - minLat)  * scale;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
  <path d="${path}" fill="none" stroke="#1E3A2A" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" />
  <circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="10" fill="#10b981" stroke="#fff" stroke-width="3" />
  <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="10" fill="#B5793E" stroke="#fff" stroke-width="3" />
</svg>`;
  const b64 = typeof Buffer !== "undefined"
    ? Buffer.from(svg).toString("base64")
    : btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${b64}`;
}
