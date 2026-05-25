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

export type PointMs = {
  t: number;
  lat: number;
  lng: number;
  speed: number | null;
  altitude?: number | null;
};

export type SplitKm = {
  km: number;            // 1-indexed (1 = first km)
  pace_min_per_km: number; // minutes per km, float
  avg_kmh: number;
  elev_gain_m: number;
  elev_loss_m: number;
};

type Rollups = {
  distance_m: number;
  elapsed_seconds: number;
  moving_seconds: number;
  avg_speed_kmh: number | null;
  max_speed_kmh: number | null;
  encoded_polyline: string;
  gait_breakdown: GaitBreakdown;
  elevation_gain_m: number;
  elevation_loss_m: number;
  splits_km: SplitKm[];
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
      elevation_gain_m: 0,
      elevation_loss_m: 0,
      splits_km: [],
    };
  }

  let distance = 0;
  let maxSpeedMps = 0;
  let movingMs = 0;
  const gaits: GaitBreakdown = { walk_s: 0, trot_s: 0, canter_s: 0, gallop_s: 0 };

  // Elevation — smooth raw altitudes with a 5-point moving average so a
  // single GPS spike doesn't add +60m of imaginary climb.
  const elevSmoothed = smoothAltitudes(points);
  let elevGain = 0;
  let elevLoss = 0;
  // Ignore micro-changes < 1m (GPS altitude noise floor).
  const ELEV_NOISE_M = 1.0;

  // Per-km splits — accumulate distance, when we cross a km boundary,
  // emit a split for the kilometre we just completed.
  const splits: SplitKm[] = [];
  let kmAccDist  = 0;
  let kmAccMs    = 0;
  let kmAccGain  = 0;
  let kmAccLoss  = 0;
  let kmIndex    = 1;

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

    // Elevation deltas via smoothed series.
    let segGain = 0;
    let segLoss = 0;
    const aAlt = elevSmoothed[i - 1];
    const bAlt = elevSmoothed[i];
    if (aAlt != null && bAlt != null) {
      const dAlt = bAlt - aAlt;
      if (dAlt > ELEV_NOISE_M) {
        segGain = dAlt;
        elevGain += dAlt;
      } else if (dAlt < -ELEV_NOISE_M) {
        segLoss = -dAlt;
        elevLoss += -dAlt;
      }
    }

    // Splits — accumulate the segment into the current km bucket.
    kmAccDist += dMeters;
    kmAccMs   += dtMs;
    kmAccGain += segGain;
    kmAccLoss += segLoss;
    while (kmAccDist >= 1000) {
      // Distribute proportionally to the carry-over.
      const carry = kmAccDist - 1000;
      const portion = carry / kmAccDist;
      const usedDist = 1000;
      const usedMs   = kmAccMs   * (1 - portion);
      const usedGain = kmAccGain * (1 - portion);
      const usedLoss = kmAccLoss * (1 - portion);
      const pace = usedMs > 0 ? (usedMs / 1000 / 60) / (usedDist / 1000) : 0;
      const avgKmh = usedMs > 0 ? (usedDist / (usedMs / 1000)) * 3.6 : 0;
      splits.push({
        km:               kmIndex,
        pace_min_per_km:  Number(pace.toFixed(2)),
        avg_kmh:          Number(avgKmh.toFixed(2)),
        elev_gain_m:      Math.round(usedGain),
        elev_loss_m:      Math.round(usedLoss),
      });
      kmIndex   += 1;
      kmAccDist  = carry;
      kmAccMs    = kmAccMs   * portion;
      kmAccGain  = kmAccGain * portion;
      kmAccLoss  = kmAccLoss * portion;
    }
  }

  // Emit the final partial km if it carries meaningful distance (>50m).
  if (kmAccDist > 50) {
    const pace = kmAccMs > 0 ? (kmAccMs / 1000 / 60) / (kmAccDist / 1000) : 0;
    const avgKmh = kmAccMs > 0 ? (kmAccDist / (kmAccMs / 1000)) * 3.6 : 0;
    splits.push({
      km:               kmIndex,
      pace_min_per_km:  Number(pace.toFixed(2)),
      avg_kmh:          Number(avgKmh.toFixed(2)),
      elev_gain_m:      Math.round(kmAccGain),
      elev_loss_m:      Math.round(kmAccLoss),
    });
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
    elevation_gain_m: Math.round(elevGain),
    elevation_loss_m: Math.round(elevLoss),
    splits_km:        splits,
  };
}

/** Rider calorie estimate. Rough — uses MET values from ACSM:
 *  walk 3.5, trot 5.5, canter 8.0, gallop 11.0.
 *  kcal = MET * mass_kg * hours.
 *  Default rider mass 65kg (we don't ask for weight — feature for later). */
export function estimateKcal(gait: GaitBreakdown, riderMassKg = 65): number {
  const METS = { walk: 3.5, trot: 5.5, canter: 8.0, gallop: 11.0 };
  const hours = (s: number) => s / 3600;
  const kcal =
    METS.walk   * riderMassKg * hours(gait.walk_s)
  + METS.trot   * riderMassKg * hours(gait.trot_s)
  + METS.canter * riderMassKg * hours(gait.canter_s)
  + METS.gallop * riderMassKg * hours(gait.gallop_s);
  return Math.round(kcal);
}

/** 5-point centred moving average. Returns array same length; nulls preserved. */
function smoothAltitudes(points: PointMs[]): Array<number | null> {
  const n = points.length;
  const raw: Array<number | null> = points.map((p) =>
    p.altitude != null && Number.isFinite(p.altitude) ? Number(p.altitude) : null,
  );
  const out: Array<number | null> = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let k = Math.max(0, i - 2); k <= Math.min(n - 1, i + 2); k++) {
      const v = raw[k];
      if (v != null) { sum += v; count += 1; }
    }
    out[i] = count > 0 ? sum / count : null;
  }
  return out;
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
