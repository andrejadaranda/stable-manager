"use client";

// Beacon viewer (Sprint 4 W3) — public, read-only.
// Renders a live map of the rider's position. Polls every 7s while
// the parent session is 'live'. Triggers an idle-alarm banner if the
// last GPS ping is older than IDLE_MINUTES while still 'live'.

import { useEffect, useRef, useState } from "react";
import type { BeaconBootstrap, BeaconPoint } from "@/services/liveSessionShares.pure";

const POLL_MS       = 7_000;
const IDLE_MINUTES  = 10;

type Status = "live" | "completed" | "abandoned";

// Minimal Leaflet shape (kept local — declaring `window.L` again would
// collide with the one in SessionMap.tsx). We resolve `window.L` via
// an unknown-cast instead of typing the global.
type LMap = {
  remove: () => void;
  fitBounds: (b: unknown, opts?: unknown) => void;
  setView: (latlng: [number, number], zoom: number) => unknown;
  panTo: (latlng: [number, number]) => unknown;
};
type LeafletLib = {
  map: (el: HTMLElement, opts?: unknown) => LMap;
  tileLayer: (url: string, opts?: unknown) => { addTo: (m: LMap) => unknown };
  polyline: (latlngs: Array<[number, number]>, opts?: unknown) => {
    addTo: (m: LMap) => unknown;
    getBounds: () => unknown;
    setLatLngs: (latlngs: Array<[number, number]>) => unknown;
  };
  circleMarker: (latlng: [number, number], opts?: unknown) => {
    addTo: (m: LMap) => unknown;
    setLatLng: (latlng: [number, number]) => unknown;
  };
};

function getWindowL(): LeafletLib | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { L?: LeafletLib }).L;
}

let loader: Promise<LeafletLib> | null = null;
function loadLeaflet(): Promise<LeafletLib> {
  if (typeof window === "undefined") return Promise.reject(new Error("no-window"));
  const existingL = getWindowL();
  if (existingL) return Promise.resolve(existingL);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-leaflet]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.setAttribute("data-leaflet", "1");
      document.head.appendChild(link);
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-leaflet]');
    if (existing) {
      const have = getWindowL();
      if (have) { resolve(have); return; }
    }
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.setAttribute("data-leaflet", "1");
    s.crossOrigin = "";
    s.onload = () => { const L = getWindowL(); if (L) resolve(L); else reject(new Error("leaflet")); };
    s.onerror = () => reject(new Error("leaflet-load"));
    document.head.appendChild(s);
  });
  return loader;
}

function toLatLng(p: BeaconPoint): [number, number] {
  return [Number(p.lat), Number(p.lng)];
}

export function BeaconViewer({ token, bootstrap }: { token: string; bootstrap: BeaconBootstrap }) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LMap | null>(null);
  const polyRef = useRef<ReturnType<LeafletLib["polyline"]> | null>(null);
  const markerRef = useRef<ReturnType<LeafletLib["circleMarker"]> | null>(null);

  const [status, setStatus]     = useState<Status>(bootstrap.status);
  const [points, setPoints]     = useState<BeaconPoint[]>(bootstrap.points);
  const [tick, setTick]         = useState(0); // forces "X seconds ago" re-render
  const [pollError, setPollError] = useState<string | null>(null);

  // ---- Initial map mount ---------------------------------------
  useEffect(() => {
    if (!mapEl.current) return;
    let disposed = false;

    void loadLeaflet().then((L) => {
      if (disposed || !mapEl.current) return;

      const m = L.map(mapEl.current, { zoomControl: true });
      mapRef.current = m;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(m);

      const latlngs = points.map(toLatLng);
      if (latlngs.length > 0) {
        polyRef.current = L.polyline(latlngs, { color: "#1E3A2A", weight: 5, opacity: 0.85 });
        polyRef.current.addTo(m);

        const last = latlngs[latlngs.length - 1];
        markerRef.current = L.circleMarker(last, {
          radius: 8,
          color: "#FFF", weight: 3, fillColor: "#B5793E", fillOpacity: 1,
        });
        markerRef.current.addTo(m);

        try { m.fitBounds(polyRef.current.getBounds(), { padding: [40, 40] }); } catch {
          m.setView(last, 14);
        }
      } else {
        m.setView([54.687, 25.279], 6); // fallback (Vilnius-ish)
      }
    });

    return () => {
      disposed = true;
      try { mapRef.current?.remove(); } catch {/* ignore */}
      mapRef.current = null;
      polyRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Poll loop ----------------------------------------------
  useEffect(() => {
    if (status !== "live") return; // no need to poll once finalized
    let active = true;

    async function poll() {
      const since = points.length > 0 ? points[points.length - 1].at : null;
      try {
        const url = `/api/live-share/${encodeURIComponent(token)}/poll${since ? `?since=${encodeURIComponent(since)}` : ""}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { status: Status; finished_at: string | null; points: BeaconPoint[] };
        if (!active) return;
        setPollError(null);
        setStatus(data.status);
        if (data.points.length > 0) {
          setPoints((prev) => {
            const next = [...prev, ...data.points];
            // Mutate the existing polyline + marker in place.
            const L = getWindowL();
            if (L && mapRef.current && polyRef.current && markerRef.current) {
              const latlngs = next.map(toLatLng);
              polyRef.current.setLatLngs(latlngs);
              const last = latlngs[latlngs.length - 1];
              markerRef.current.setLatLng(last);
              mapRef.current.panTo(last);
            }
            return next;
          });
        }
      } catch (err: any) {
        if (!active) return;
        setPollError(err?.message ?? "poll_failed");
      }
    }

    const id = window.setInterval(poll, POLL_MS);
    return () => { active = false; window.clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, token]);

  // ---- "last seen X ago" ticker --------------------------------
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // ---- Derived state -------------------------------------------
  const lastAt = points.length > 0 ? new Date(points[points.length - 1].at) : null;
  const ageSec = lastAt ? Math.max(0, Math.floor((Date.now() - lastAt.getTime()) / 1000)) : null;
  const lastSpeedMps = points.length > 0 ? Number(points[points.length - 1].spd ?? 0) : 0;
  const lastSpeedKmh = lastSpeedMps > 0 ? lastSpeedMps * 3.6 : 0;

  const idleAlarm =
    status === "live" && ageSec != null && ageSec > IDLE_MINUTES * 60;

  // suppress unused var
  void tick;

  return (
    <div className="relative w-full h-screen">
      {/* Map fills the viewport */}
      <div ref={mapEl} className="absolute inset-0 z-0" />

      {/* Top status bar */}
      <div className="absolute top-0 left-0 right-0 z-10 px-3 pt-3 pointer-events-none">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white/95 backdrop-blur border border-ink-200 shadow-lift px-4 py-3 flex items-center gap-3 pointer-events-auto">
          <span
            className={`inline-flex h-2.5 w-2.5 rounded-full ${
              status === "live" ? "bg-emerald-500 animate-pulse" : "bg-ink-400"
            }`}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-500">
              {bootstrap.stable_name ?? "Live ride"}
            </p>
            <p className="text-sm font-semibold text-ink-900 truncate">
              {bootstrap.horse_name ?? "Ride"} ·{" "}
              {status === "live"
                ? `Live · ${ageSec != null ? formatAge(ageSec) : "…"}`
                : status === "completed"
                ? "Ride completed"
                : "Ride ended"}
            </p>
          </div>
          {status === "live" && (
            <div className="text-right shrink-0">
              <p className="text-[10.5px] uppercase tracking-[0.12em] text-ink-500 font-semibold">Speed</p>
              <p className="font-display text-lg text-navy-800 leading-none">
                {lastSpeedKmh.toFixed(1)}<span className="text-xs text-ink-500 ml-1">km/h</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Idle alarm banner */}
      {idleAlarm && (
        <div className="absolute top-20 left-0 right-0 z-10 px-3 pointer-events-none">
          <div className="mx-auto max-w-3xl rounded-2xl bg-red-600 text-white shadow-lift px-4 py-3 pointer-events-auto">
            <p className="text-sm font-semibold">
              No GPS update for {Math.floor((ageSec ?? 0) / 60)} minutes.
            </p>
            <p className="text-xs opacity-90 mt-1">
              The rider's phone may have lost signal, or they may need help. Try calling them.
            </p>
          </div>
        </div>
      )}

      {/* Footer attribution */}
      <div className="absolute bottom-3 left-0 right-0 z-10 text-center pointer-events-none">
        <p className="text-[11px] text-cream-200/90">
          Tracked with Longrein. · <a href="https://longrein.eu" className="underline">longrein.eu</a>
        </p>
      </div>

      {/* Poll error toast */}
      {pollError && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-10 rounded-md bg-ink-900/90 text-cream-50 text-[11px] px-3 py-1.5">
          Reconnecting… ({pollError})
        </div>
      )}
    </div>
  );
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `last seen ${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `last seen ${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  return `last seen ${hrs}h ${mins % 60}m ago`;
}
