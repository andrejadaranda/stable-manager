/* Service worker for the private command centre (/personal).
 *
 * Registered with scope "/personal/" — see components/personal/service-worker.tsx.
 * It must never touch the rest of Longrein, so every fetch handler below
 * bails out early for anything outside that scope.
 *
 * Caching strategy, deliberately conservative:
 *
 *   /_next/static/*  -> cache-first. Content-hashed filenames, so a
 *                       cached copy can never be stale.
 *   navigations      -> network-first with an offline fallback page.
 *                       These responses are personal, authenticated HTML;
 *                       serving a cached copy to a later request would be
 *                       a data-leak risk if the device is ever shared, and
 *                       a stale "who hasn't ridden in 14 days" is worse
 *                       than an honest offline notice. So: never stored.
 *   everything else  -> straight to network, untouched.
 */

const CACHE = "personal-v1";
// Lives outside /personal because everything inside that segment runs the
// allowlist gate — an offline page there would 404 exactly when needed.
// Caching a URL outside the worker's scope is fine; only *controlling*
// navigations is scope-limited, and this is only ever used as a fallback
// body for a /personal navigation.
const OFFLINE_URL = "/personal-offline";

// Pre-cache only the offline shell. Everything else fills in on demand,
// which keeps install fast and avoids shipping a stale asset manifest.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .catch(() => {
        /* offline at install time — the fallback fills in on first online load */
      })
      .then(() => self.skipWaiting()),
  );
});

// Drop caches from older versions of this worker on activate.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("personal-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Content-hashed build assets: cache-first, then fill.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            // Only store complete, successful responses.
            if (res && res.status === 200 && res.type === "basic") {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Page navigations inside /personal: network-first, offline fallback.
  // Nothing is written to the cache here — see the header comment.
  if (req.mode === "navigate" && url.pathname.startsWith("/personal")) {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(OFFLINE_URL).then(
          (hit) =>
            hit ||
            new Response(
              "<!doctype html><meta charset=utf-8><title>Neprisijungta</title>" +
                "<body style=\"font-family:system-ui;padding:2rem;background:#F8F4EE;color:#1C1A17\">" +
                "<h1 style=\"font-size:1.1rem\">Nėra ryšio</h1>" +
                "<p style=\"color:#7B7167\">Prisijunk prie interneto ir bandyk dar kartą.</p>",
              { headers: { "content-type": "text/html; charset=utf-8" } },
            ),
        ),
      ),
    );
  }

  // Anything else: default network behaviour, no interception.
});

/* ---------------- Web Push ----------------
 * Plumbing only. Nothing schedules these yet — see the follow-up list in
 * docs/PERSONAL-DASHBOARD.md. Once a cron posts to the send endpoint,
 * daily briefings and urgent alerts arrive here with no further client work.
 * iOS delivers Web Push only when the app has been added to the Home
 * Screen (iOS 16.4+).
 */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Andrėja", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Andrėja", {
      body: data.body || "",
      tag: data.tag || undefined,
      data: { url: data.url || "/personal" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/personal";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ("focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
      }),
  );
});
