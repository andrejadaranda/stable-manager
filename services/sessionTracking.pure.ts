// Pure helpers for live session tracking.
// MUST NOT import server-only code (next/headers, supabase/server) so
// client components can use these for live preview, map rendering, etc.
//
// services/sessionTracking.ts re-exports from here for server callers.

export type TrackPointInput = {
  /** ISO timestamp of when the GPS fix happened on the device. */
  recordedAt: string;
  lat: number;
  lng: number;
  /** Meters above WGS84 ellipsoid (optional, often null indoors). */
  altitude?: number | null;
  /** GPS accuracy in meters (lower = better). */
  accuracy?: number | null;
  /** Speed in m/s straight from the geolocation API. */
  speed?: number | null;
  /** Heading degrees true-north (optional). */
  heading?: number | null;
};

export type GaitBreakdown = {
  walk_s: number;     // <  7 km/h
  trot_s: number;     // 7–17
  canter_s: number;   // 17–30
  gallop_s: number;   // 30+
};

type PointMs = { t: number; lat: number; lng: number; speed: number | null };

type Rollups = {
  distance_m: number;
  elapsed_seconds: number;
  moving_seconds: number;
  avg_speed_kmh: number | null;
  max_speed_kmh: number | null;
  encoded_polyline: string;
  gait_breakdown: GaitBreakdown;
};

/** Compute distance via Haversine, splits, polyline + gait buckets.
 *  Pure — does no IO. Exported so the live client can preview live
 *  distance + speed without round-tripping the server. */
export function computeRollups(points: PointMs[]): Rollups {
  if (points.length === 0) {
    return {
      distance_m: 0,
      elapsed_seconds: 0,
      moving_seconds: 0,
      avg_speed_kmh: null,
      max_speed_kmh: null,
      encoded_polyline: "",
      gait_breakdown: { walk_s: 0, trot_s: 0, canter_s: 0, gallop_s: 0 },
    };
  }

  let distance = 0;
  let maxSpeedMps = 0;
  let movingMs = 0;
  const gaits: GaitBreakdown = { walk_s: 0, trot_s: 0, canter_s: 0, gallop_s: 0 };

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dMeters = haversine(a.lat, a.lng, b.lat, b.lng);
    const dtMs = b.t - a.t;
    if (dtMs <= 0) continue;

    distance += dMeters;

    const speedMps = b.speed != null && Number.isFinite(b.speed) && b.speed >= 0
      ? b.speed
      : (dMeters / (dtMs / 1000));

    if (speedMps > maxSpeedMps) maxSpeedMps = speedMps;

    const segSec = dtMs / 1000;
    if (speedMps > 0.5) movingMs += dtMs;

    const kmh = speedMps * 3.6;
    if      (kmh < 7)  gaits.walk_s   += segSec;
    else if (kmh < 17) gaits.trot_s   += segSec;
    else if (kmh < 30) gaits.canter_s += segSec;
    else               gaits.gallop_s += segSec;
  }

  const elapsedMs = points[points.length - 1].t - points[0].t;
  const elapsedSec = Math.round(elapsedMs / 1000);
  const movingSec  = Math.round(movingMs / 1000);

  const avgKmh = movingSec > 0
    ? Number(((distance / movingSec) * 3.6).toFixed(2))
    : null;
  const maxKmh = maxSpeedMps > 0
    ? Number((maxSpeedMps * 3.6).toFixed(2))
    : null;

  const polyPts: Array<{ lat: number; lng: number }> = [];
  let lastT = -Infinity;
  for (const p of points) {
    if (p.t - lastT >= 3000) {
      polyPts.push({ lat: p.lat, lng: p.lng });
      lastT = p.t;
    }
  }
  if (polyPts.length === 0 && points.length > 0) {
    polyPts.push({ lat: points[0].lat, lng: points[0].lng });
  }
  const encoded = encodePolyline(polyPts);

  return {
    distance_m:       Math.round(distance),
    elapsed_seconds:  elapsedSec,
    moving_seconds:   movingSec,
    avg_speed_kmh:    avgKmh,
    max_speed_kmh:    maxKmh,
    encoded_polyline: encoded,
    gait_breakdown: {
      walk_s:   Math.round(gaits.walk_s),
      trot_s:   Math.round(gaits.trot_s),
      canter_s: Math.round(gaits.canter_s),
      gallop_s: Math.round(gaits.gallop_s),
    },
  };
}

/** Great-circle distance in meters (Earth radius 6371008.8m, WGS84 mean). */
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Google encoded polyline (precision 5). Compact route storage that
 *  every map library — Leaflet, Mapbox, Google Maps — can decode. */
export function encodePolyline(points: Array<{ lat: number; lng: number }>): string {
  let out = "";
  let prevLat = 0;
  let prevLng = 0;
  for (const p of points) {
    const lat = Math.round(p.lat * 1e5);
    const lng = Math.round(p.lng * 1e5);
    out += encodeValue(lat - prevLat) + encodeValue(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return out;
}

function encodeValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : (value << 1);
  let out = "";
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  out += String.fromCharCode(v + 63);
  return out;
}

/** Inverse — used by the detail page to feed Leaflet. */
export function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const out: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0; result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    out.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return out;
}
