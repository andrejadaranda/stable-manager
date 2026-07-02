"use client";

// LiveTracker — Strava-style live ride UI.
//
// Lifecycle:
//   IDLE        → user picks horse + type, taps START
//   STARTING    → server creates a live session row
//   TRACKING    → geolocation.watchPosition pushes points to a local buffer
//                 every position fix. A flush loop POSTs buffered points
//                 every 10s via appendPointsAction. Wake Lock keeps screen on.
//   PAUSED      → watch stopped, buffer flushed, timer halted. Resume returns to TRACKING.
//   STOPPING    → flush remaining buffer, then finalizeLiveAction. Redirect to detail.
//
// IMPORTANT — PWA limitation: navigator.geolocation only fires while the
// tab is foreground. Wake Lock keeps the screen awake but if the user
// switches apps, points stop until they return. The detail page renders
// whatever was captured. Native iOS app (summer 2026) will background-track.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  startLiveAction,
  appendPointsAction,
  finalizeLiveAction,
  abandonLiveAction,
  type StartLiveState,
  type FinalizeLiveState,
} from "@/app/dashboard/sessions/live/actions";
import {
  SESSION_TYPES,
  SESSION_TYPE_LABEL,
  type SessionType,
} from "@/services/sessions.types";
import {
  computeRollups,
  haversine,
  type TrackPointInput,
} from "@/services/sessionTracking.pure";

type HorseOpt = { id: string; name: string };

type Phase = "idle" | "starting" | "tracking" | "paused" | "stopping";

type LocalPoint = TrackPointInput & { t: number };

// Flush buffered points every 10s while tracking.
const FLUSH_INTERVAL_MS = 10_000;
// Minimum movement (m) between accepted points — filters GPS jitter while standing.
const MIN_DELTA_M = 3;

// Normalised position fix — the shape handlePosition consumes, filled from
// either the native Capacitor plugin or web navigator.geolocation.
type GeoFix = {
  latitude:  number;
  longitude: number;
  altitude:  number | null;
  accuracy:  number | null;
  speed:     number | null;
  heading:   number | null;
  timestamp: number;
};
type GeoErrKind = "denied" | "unavailable" | "timeout";

// Native-aware GPS watch. On the iOS app it uses @capacitor/geolocation
// (real CLLocationManager — works inside the WKWebView shell AND can keep
// recording in the background with the Location Updates capability). On the
// web it falls back to navigator.geolocation. This is what makes the native
// app's GPS actually work + gives it functionality the web PWA can't (App
// Store guideline 4.2). Native modules are dynamically imported + ts-ignored
// so the sandbox build (which doesn't install them) still type-checks.
async function startGeoWatch(
  onFix: (fix: GeoFix) => void,
  onErr: (kind: GeoErrKind) => void,
): Promise<{ clear: () => void }> {
  let isNative = false;
  try {
    // @ts-ignore optional native dependency (resolved on device/Vercel)
    const cap = await import("@capacitor/core");
    isNative = cap?.Capacitor?.isNativePlatform?.() ?? false;
  } catch {
    isNative = false;
  }

  if (isNative) {
    // @ts-ignore optional native dependency (resolved on device/Vercel)
    const { Geolocation } = await import("@capacitor/geolocation");
    try {
      const perm = await Geolocation.requestPermissions();
      if (perm?.location === "denied") { onErr("denied"); return { clear: () => {} }; }
    } catch { /* proceed — watchPosition will surface a real error */ }
    let watchId: string | null = null;
    try {
      watchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 1_000 },
        (position: any, err: any) => {
          if (err) { onErr("unavailable"); return; }
          if (!position) return;
          const c = position.coords ?? {};
          onFix({
            latitude:  c.latitude,
            longitude: c.longitude,
            altitude:  c.altitude ?? null,
            accuracy:  c.accuracy ?? null,
            speed:     c.speed ?? null,
            heading:   c.heading ?? null,
            timestamp: position.timestamp ?? Date.now(),
          });
        },
      );
    } catch {
      onErr("unavailable");
    }
    return { clear: () => { try { if (watchId) Geolocation.clearWatch({ id: watchId }); } catch { /* noop */ } } };
  }

  // ---- Web fallback ----
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onErr("unavailable");
    return { clear: () => {} };
  }
  const wid = navigator.geolocation.watchPosition(
    (pos) => onFix({
      latitude:  pos.coords.latitude,
      longitude: pos.coords.longitude,
      altitude:  pos.coords.altitude ?? null,
      accuracy:  pos.coords.accuracy ?? null,
      speed:     pos.coords.speed ?? null,
      heading:   pos.coords.heading ?? null,
      timestamp: pos.timestamp || Date.now(),
    }),
    (err) => onErr(
      err.code === err.PERMISSION_DENIED ? "denied"
      : err.code === err.TIMEOUT ? "timeout"
      : "unavailable",
    ),
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 15_000 },
  );
  return { clear: () => navigator.geolocation.clearWatch(wid) };
}

export function LiveTracker({
  horses,
  resumeSessionId,
}: {
  horses: HorseOpt[];
  /** If non-null, jump straight into TRACKING for this in-flight session. */
  resumeSessionId?: string | null;
}) {
  const router = useRouter();

  // ----- Form state (IDLE only) -----
  const [horseId, setHorseId] = useState<string>("");
  const [type, setType]       = useState<SessionType>("hack");

  // ----- Tracker state -----
  const [phase, setPhase]         = useState<Phase>(resumeSessionId ? "tracking" : "idle");
  const [sessionId, setSessionId] = useState<string | null>(resumeSessionId ?? null);
  const [error, setError]         = useState<string | null>(null);

  // Live numbers — driven by client buffer for instant feedback.
  const [elapsedSec, setElapsedSec] = useState(0);
  const [distanceM, setDistanceM]   = useState(0);
  const [speedKmh, setSpeedKmh]     = useState(0);
  const [pointCount, setPointCount] = useState(0);
  const [accuracyM, setAccuracyM]   = useState<number | null>(null);

  // Mutable refs (don't trigger re-renders).
  const watchRef      = useRef<{ clear: () => void } | null>(null);
  const wantTrackingRef = useRef(false);
  const wakeLockRef   = useRef<WakeLockSentinel | null>(null);
  const bufferRef     = useRef<LocalPoint[]>([]);   // unsent points
  const allPointsRef  = useRef<LocalPoint[]>([]);   // every point this ride for local rollups
  const flushTimerRef = useRef<number | null>(null);
  const tickTimerRef  = useRef<number | null>(null);
  const startMsRef    = useRef<number | null>(null);

  // ===== GEO =====
  function handlePosition(fix: GeoFix) {
    const t = fix.timestamp || Date.now();
    const lat = fix.latitude;
    const lng = fix.longitude;
    const last = allPointsRef.current[allPointsRef.current.length - 1];

    // Filter near-duplicate points (standing still). Accept the first
    // unconditionally so we anchor the map.
    if (last) {
      const d = haversine(last.lat, last.lng, lat, lng);
      if (d < MIN_DELTA_M) return;
    }

    const point: LocalPoint = {
      t,
      recordedAt: new Date(t).toISOString(),
      lat,
      lng,
      altitude: fix.altitude,
      accuracy: fix.accuracy,
      speed:    fix.speed,
      heading:  fix.heading,
    };

    bufferRef.current.push(point);
    allPointsRef.current.push(point);

    // Recompute live rollups for the UI.
    const r = computeRollups(allPointsRef.current.map((p) => ({
      t: p.t, lat: p.lat, lng: p.lng,
      speed: p.speed ?? null,
    })));
    setDistanceM(r.distance_m);
    setPointCount(allPointsRef.current.length);
    if (fix.speed != null && fix.speed >= 0) {
      setSpeedKmh(Number((fix.speed * 3.6).toFixed(1)));
    }
    setAccuracyM(fix.accuracy);
  }

  function handleGeoError(kind: GeoErrKind) {
    if (kind === "denied") {
      setError("Location permission denied. Enable location for Longrein in Settings.");
    } else if (kind === "unavailable") {
      setError("GPS signal unavailable. Move to open sky.");
    }
    // "timeout" is soft — keep trying, no message.
  }

  // ===== WAKE LOCK =====
  async function acquireWakeLock() {
    try {
      // Wake Lock API is supported in iOS 16.4+ Safari / Chrome / Edge.
      const nav = navigator as Navigator & {
        wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
      };
      if (nav.wakeLock?.request) {
        wakeLockRef.current = await nav.wakeLock.request("screen");
      }
    } catch {
      // No-op: feature missing or user denied. Tracking still works,
      // user just needs to keep the screen tapped.
    }
  }

  function releaseWakeLock() {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }

  // ===== FLUSH LOOP =====
  async function flushBuffer() {
    if (!sessionId) return;
    if (bufferRef.current.length === 0) return;
    const batch = bufferRef.current.splice(0, bufferRef.current.length);
    const res = await appendPointsAction(sessionId, batch.map((p) => ({
      recordedAt: p.recordedAt,
      lat: p.lat, lng: p.lng,
      altitude: p.altitude, accuracy: p.accuracy,
      speed: p.speed, heading: p.heading,
    })));
    if (res.error) {
      // Put them back so we retry next tick.
      bufferRef.current.unshift(...batch);
      setError(res.error);
    } else {
      setError(null);
    }
  }

  // ===== TICK (elapsed) =====
  function startTicking() {
    if (tickTimerRef.current) window.clearInterval(tickTimerRef.current);
    tickTimerRef.current = window.setInterval(() => {
      if (startMsRef.current != null) {
        setElapsedSec(Math.floor((Date.now() - startMsRef.current) / 1000));
      }
    }, 500);
  }
  function stopTicking() {
    if (tickTimerRef.current) {
      window.clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
  }

  // ===== TRACKING CONTROL =====
  function beginTracking(newSessionId: string) {
    if (startMsRef.current == null) startMsRef.current = Date.now();
    setSessionId(newSessionId);
    setPhase("tracking");

    // Clear any prior watch, then start a native-aware one (Capacitor
    // Geolocation on the iOS app, navigator.geolocation on web).
    watchRef.current?.clear();
    watchRef.current = null;
    wantTrackingRef.current = true;
    startGeoWatch(handlePosition, handleGeoError).then((w) => {
      // If tracking was stopped before the async watch resolved, clear it now.
      if (!wantTrackingRef.current) { w.clear(); return; }
      watchRef.current = w;
    });

    acquireWakeLock();
    startTicking();

    if (flushTimerRef.current) window.clearInterval(flushTimerRef.current);
    flushTimerRef.current = window.setInterval(() => { flushBuffer(); }, FLUSH_INTERVAL_MS);
  }

  function stopWatching() {
    wantTrackingRef.current = false;
    watchRef.current?.clear();
    watchRef.current = null;
    releaseWakeLock();
    if (flushTimerRef.current) {
      window.clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    stopTicking();
  }

  // ===== START =====
  async function onStart() {
    setError(null);
    setPhase("starting");
    const fd = new FormData();
    if (horseId) fd.set("horse_id", horseId);
    fd.set("type", type);
    const initial: StartLiveState = { error: null, sessionId: null, resumeId: null };
    const res = await startLiveAction(initial, fd);
    if (res.error || !res.sessionId) {
      setPhase("idle");
      setError(res.error);
      if (res.resumeId) {
        // Surface a resume hint — user can refresh and resumeSessionId
        // prop will be set by the page.
        setError((res.error ?? "") + " Refresh to resume.");
      }
      return;
    }
    beginTracking(res.sessionId);
  }

  // ===== PAUSE / RESUME =====
  function onPause() {
    stopWatching();
    flushBuffer(); // best-effort
    setPhase("paused");
  }
  function onResume() {
    if (!sessionId) return;
    beginTracking(sessionId);
  }

  // ===== STOP & FINALIZE =====
  async function onStop() {
    setPhase("stopping");
    stopWatching();
    await flushBuffer();

    const fd = new FormData();
    fd.set("session_id", sessionId ?? "");
    if (horseId) fd.set("horse_id", horseId);
    const initial: FinalizeLiveState = { error: null, done: false };
    const res = await finalizeLiveAction(initial, fd);
    if (res.error) {
      setError(res.error);
      setPhase("paused");
      return;
    }
    // Redirect to the detail page.
    router.push(`/dashboard/sessions/${sessionId}`);
    router.refresh();
  }

  async function onDiscard() {
    if (!sessionId) return;
    if (!window.confirm("Discard this ride? Tracked data will be lost.")) return;
    stopWatching();
    await abandonLiveAction(sessionId);
    router.push("/dashboard/sessions");
    router.refresh();
  }

  // ===== If resuming on mount, kick off tracking. =====
  useEffect(() => {
    if (resumeSessionId) {
      beginTracking(resumeSessionId);
    }
    return () => {
      stopWatching();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Re-acquire wake lock when tab becomes visible again. =====
  useEffect(() => {
    function onVis() {
      if (document.visibilityState === "visible" && phase === "tracking") {
        acquireWakeLock();
      }
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [phase]);

  // ============================== RENDER ==============================

  if (phase === "idle") {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl border border-ink-100 shadow-soft p-6 space-y-5">
          <div>
            <h2 className="font-display text-2xl text-navy-700 leading-tight">
              Start a live ride
            </h2>
            <p className="text-sm text-ink-500 mt-1.5 leading-relaxed">
              Track distance, route and speed in real time. Keep your phone awake — true background tracking ships with the iOS app.
            </p>
          </div>

          <label className="block">
            <span className="block text-xs font-medium text-ink-700 mb-1.5">Horse <span className="text-ink-400 font-normal">(optional)</span></span>
            <select
              value={horseId}
              onChange={(e) => setHorseId(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-ink-200 bg-white text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            >
              <option value="">— pick later —</option>
              {horses.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-ink-700 mb-1.5">Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as SessionType)}
              className="w-full h-11 px-3 rounded-xl border border-ink-200 bg-white text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            >
              {SESSION_TYPES.map((t) => (
                <option key={t} value={t}>{SESSION_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </label>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={onStart}
            className="
              w-full h-14 rounded-2xl text-base font-semibold text-white
              bg-brand-600 hover:bg-brand-700 active:bg-brand-800
              shadow-md transition-colors
              focus:outline-none focus:ring-4 focus:ring-brand-500/30
            "
          >
            ▶  Start ride
          </button>

          <p className="text-[11.5px] text-ink-400 text-center leading-relaxed">
            Allow location access when prompted. Works best outside.
          </p>
        </div>
      </div>
    );
  }

  // TRACKING / PAUSED / STOPPING UI
  const km = (distanceM / 1000).toFixed(2);
  const time = formatHMS(elapsedSec);
  const avgKmh = elapsedSec > 0 ? ((distanceM / elapsedSec) * 3.6).toFixed(1) : "0.0";

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden">
        {/* Status pill */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100 bg-ink-50/50">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${
              phase === "tracking" ? "bg-emerald-500 animate-pulse" :
              phase === "paused"   ? "bg-amber-500" :
              "bg-ink-400"
            }`} />
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-700">
              {phase === "tracking" ? "Live" : phase === "paused" ? "Paused" : "Saving…"}
            </span>
          </div>
          {accuracyM != null && (
            <span className="text-[11px] text-ink-500">
              GPS ±{Math.round(accuracyM)}m · {pointCount} pts
            </span>
          )}
        </div>

        {/* Big numbers */}
        <div className="px-6 py-7 text-center space-y-1">
          <div className="font-display text-5xl tabular-nums text-navy-700">
            {km} <span className="text-2xl text-ink-500">km</span>
          </div>
          <div className="text-sm text-ink-500">distance</div>
        </div>

        {/* Secondary stats grid */}
        <div className="grid grid-cols-3 border-t border-ink-100 divide-x divide-ink-100">
          <Stat label="Time"     value={time} />
          <Stat label="Speed"    value={`${speedKmh.toFixed(1)} km/h`} />
          <Stat label="Avg"      value={`${avgKmh} km/h`} />
        </div>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border-t border-red-200 px-4 py-2.5">
            {error}
          </div>
        )}

        {/* Action row */}
        <div className="px-5 py-5 border-t border-ink-100 flex gap-3">
          {phase === "tracking" && (
            <>
              <button
                type="button"
                onClick={onPause}
                className="flex-1 h-12 rounded-xl border border-ink-200 bg-white text-sm font-medium text-ink-900 hover:bg-ink-50 transition-colors"
              >
                ❚❚ Pause
              </button>
              <button
                type="button"
                onClick={onStop}
                className="flex-1 h-12 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors"
              >
                ■ Stop & save
              </button>
            </>
          )}
          {phase === "paused" && (
            <>
              <button
                type="button"
                onClick={onDiscard}
                className="flex-1 h-12 rounded-xl border border-red-200 bg-white text-sm font-medium text-red-700 hover:bg-red-50 transition-colors"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={onResume}
                className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
              >
                ▶ Resume
              </button>
              <button
                type="button"
                onClick={onStop}
                className="flex-1 h-12 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors"
              >
                Save
              </button>
            </>
          )}
          {phase === "stopping" && (
            <div className="flex-1 h-12 rounded-xl bg-ink-100 text-ink-700 text-sm font-medium flex items-center justify-center">
              Saving ride…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-4 text-center">
      <div className="font-display text-lg tabular-nums text-navy-700">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-ink-500 mt-0.5">{label}</div>
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
