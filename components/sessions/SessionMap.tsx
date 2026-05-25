"use client";

// Leaflet route map — renders an encoded polyline on OpenStreetMap tiles.
// FREE (no API key), works everywhere, mobile-pinch-zoom native.
//
// Implementation: we import Leaflet CSS + JS from CDN at runtime (no
// bundler dep, no SSR concerns). The map mounts only on the client.

import { useEffect, useRef } from "react";
import { decodePolyline } from "@/services/sessionTracking";

// Minimal Leaflet types we touch — avoids pulling @types/leaflet for a
// 60-line component.
type LMap = {
  remove: () => void;
  fitBounds: (b: unknown, opts?: unknown) => void;
  setView: (latlng: [number, number], zoom: number) => unknown;
};
type LeafletLib = {
  map: (el: HTMLElement, opts?: unknown) => LMap;
  tileLayer: (url: string, opts?: unknown) => { addTo: (m: LMap) => unknown };
  polyline: (latlngs: Array<[number, number]>, opts?: unknown) => {
    addTo: (m: LMap) => unknown;
    getBounds: () => unknown;
  };
  circleMarker: (latlng: [number, number], opts?: unknown) => {
    addTo: (m: LMap) => unknown;
  };
};

declare global {
  interface Window {
    L?: LeafletLib;
  }
}

let leafletLoading: Promise<LeafletLib> | null = null;
function loadLeaflet(): Promise<LeafletLib> {
  if (typeof window === "undefined") return Promise.reject(new Error("no-window"));
  if (window.L) return Promise.resolve(window.L);
  if (leafletLoading) return leafletLoading;

  leafletLoading = new Promise((resolve, reject) => {
    // CSS
    if (!document.querySelector('link[data-leaflet]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.setAttribute("data-leaflet", "1");
      link.crossOrigin = "";
      document.head.appendChild(link);
    }
    // JS
    const existing = document.querySelector<HTMLScriptElement>('script[data-leaflet]');
    if (existing && window.L) {
      resolve(window.L);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.async = true;
    s.crossOrigin = "";
    s.setAttribute("data-leaflet", "1");
    s.onload = () => {
      if (window.L) resolve(window.L);
      else reject(new Error("Leaflet failed to attach"));
    };
    s.onerror = () => reject(new Error("Leaflet CDN failed"));
    document.head.appendChild(s);
  });
  return leafletLoading;
}

export function SessionMap({ encodedPolyline }: { encodedPolyline: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<LMap | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!encodedPolyline) return;

    let cancelled = false;

    loadLeaflet().then((L) => {
      if (cancelled || !containerRef.current) return;

      const points = decodePolyline(encodedPolyline);
      if (points.length === 0) return;

      const latlngs: Array<[number, number]> = points.map((p) => [p.lat, p.lng]);

      const map = L.map(containerRef.current, {
        scrollWheelZoom: false,
        zoomControl: true,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const line = L.polyline(latlngs, {
        color: "#1E3A2A",  // brand paddock-green
        weight: 4,
        opacity: 0.9,
        lineJoin: "round",
      });
      // addTo returns the layer (Leaflet chain). Use the polyline ref for bounds.
      (line as unknown as { addTo: (m: LMap) => void }).addTo(map);

      // Start + end markers.
      L.circleMarker(latlngs[0], {
        radius: 6, color: "#fff", weight: 2,
        fillColor: "#10b981", fillOpacity: 1,
      }).addTo(map);
      L.circleMarker(latlngs[latlngs.length - 1], {
        radius: 6, color: "#fff", weight: 2,
        fillColor: "#B5793E", fillOpacity: 1,
      }).addTo(map);

      map.fitBounds((line as unknown as { getBounds: () => unknown }).getBounds(), { padding: [24, 24] });
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [encodedPolyline]);

  if (!encodedPolyline) {
    return (
      <div className="aspect-[16/10] rounded-xl border border-ink-100 bg-cream-50 flex items-center justify-center text-sm text-ink-500">
        No GPS data — this ride wasn't tracked live.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="aspect-[16/10] rounded-xl border border-ink-100 overflow-hidden bg-cream-50"
      aria-label="Ride route map"
    />
  );
}
