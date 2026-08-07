#!/usr/bin/env node
//
// Route-level smoke test for the private command centre.
//
// Boots the PRODUCTION build (`next start`) on a spare port and asserts
// the things a unit test cannot: that the routes exist, that the access
// gate actually closes, and that adding this feature did not break the
// product's own pages.
//
// WHAT THIS DOES NOT DO, and why:
// It does not assert an authenticated 200 with rendered cards. Doing that
// needs a real Supabase session for a real allowlisted user, which would
// mean either minting a session for her account with the service-role key
// (impersonating her) or creating a test user in the production database.
// Neither is something a test script should do unasked. So the automated
// assertion is "the gate holds and nothing 500s", and the authenticated
// render is verified by opening it.
//
// Usage:  npm run build && npm run test:routes

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = process.env.SMOKE_PORT ?? "3999";
const BASE = `http://127.0.0.1:${PORT}`;
const BOOT_TIMEOUT_MS = 60_000;

let failures = 0;
let passes = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passes += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// -------------------------------------------------------------------
// 1. The build actually contains the routes.
//
// Every gate assertion below expects a 404, and a route that was never
// compiled also returns 404. Without this check the whole suite would
// pass just as happily against a build with no /personal in it at all.
// -------------------------------------------------------------------
console.log("\nbuild output");
for (const path of [
  ".next/server/app/personal/page.js",
  ".next/server/app/personal/longrein/page.js",
  ".next/server/app/personal/nustatymai/page.js",
  ".next/server/app/api/health/route.js",
  ".next/server/app/personal/social/page.js",
  ".next/server/app/personal/tikslai/page.js",
  ".next/server/app/api/personal/push/subscribe/route.js",
  ".next/server/app/api/personal/push/daily/route.js",
  ".next/server/app/api/personal/social/publish-scheduled/route.js",
]) {
  check(`compiled ${path.replace(".next/server/app", "")}`, existsSync(path));
}

if (failures > 0) {
  console.error("\nBuild output is missing routes — run `npm run build` first.\n");
  process.exit(1);
}

// -------------------------------------------------------------------
// 2. Boot the server.
// -------------------------------------------------------------------
const server = spawn("npx", ["next", "start", "-p", PORT], {
  stdio: ["ignore", "pipe", "pipe"],
  env: process.env,
});

let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));

async function waitForBoot() {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/keepalive`, { signal: AbortSignal.timeout(3000) });
      if (res.status > 0) return true;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  return false;
}

function stopServer() {
  try {
    server.kill("SIGTERM");
  } catch {
    /* already gone */
  }
}

process.on("exit", stopServer);
process.on("SIGINT", () => {
  stopServer();
  process.exit(130);
});

const booted = await waitForBoot();
if (!booted) {
  console.error("\nServer did not start within 60s. Output:\n", serverLog.slice(-2000));
  stopServer();
  process.exit(1);
}

// -------------------------------------------------------------------
// 3. The gate.
//
// Anonymous callers must get 404 — not 403, not 500. A 403 would confirm
// the route exists to someone who shouldn't know; a 500 would mean the
// gate threw rather than denied, which fails open in the worst way.
// -------------------------------------------------------------------
console.log("\naccess gate (anonymous)");
for (const path of [
  "/personal",
  "/personal/tjk",
  "/personal/finansai",
  "/personal/marketing",
  "/personal/longrein",
  "/personal/tikslai",
  "/personal/social",
  "/personal/nustatymai",
]) {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
  check(`${path} → 404`, res.status === 404, `got ${res.status}`);
}

console.log("\npersonal API (unauthenticated)");
{
  const res = await fetch(`${BASE}/api/personal/push/subscribe`);
  check("GET /api/personal/push/subscribe → 404", res.status === 404, `got ${res.status}`);
}
{
  const res = await fetch(`${BASE}/api/personal/push/subscribe`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint: "https://example.test/x", keys: { p256dh: "a", auth: "b" } }),
  });
  check("POST /api/personal/push/subscribe → 404", res.status === 404, `got ${res.status}`);
}
{
  const res = await fetch(`${BASE}/api/personal/push/daily`);
  check("GET /api/personal/push/daily → 401", res.status === 401, `got ${res.status}`);
}
{
  // Two legitimate outcomes, depending on whether CRON_SECRET is set in
  // this environment. Production has it, so the sweep 401s without a
  // bearer; a local build usually does not, and then the route falls
  // back to its by-construction safety. Either way the invariant under
  // test is the same: an unauthenticated call must never publish.
  const res = await fetch(`${BASE}/api/personal/social/publish-scheduled`);
  check(
    "GET /api/personal/social/publish-scheduled → 200 or 401",
    res.status === 200 || res.status === 401,
    `got ${res.status}`,
  );
  const body = await res.json().catch(() => null);
  check(
    "unauthenticated publish sweep publishes nothing",
    Boolean(body) &&
      (res.status === 401 || body.published === 0 || body.skipped === "throttled"),
    JSON.stringify(body),
  );
}
{
  // No secret configured yet → the route denies. 404 (not configured) and
  // 401 (configured, wrong secret) are both correct refusals.
  const res = await fetch(`${BASE}/api/personal/briefing`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ summary: "smoke test" }),
  });
  check(
    "POST /api/personal/briefing unauthenticated → 401/404",
    res.status === 401 || res.status === 404,
    `got ${res.status}`,
  );
}

// -------------------------------------------------------------------
// 4. The health endpoint — public by design, and the uptime source.
// -------------------------------------------------------------------
console.log("\nhealth endpoint");
{
  const res = await fetch(`${BASE}/api/health`);
  check("GET /api/health → 200 or 503", res.status === 200 || res.status === 503, `got ${res.status}`);
  const body = await res.json().catch(() => null);
  check("GET /api/health returns { ok, latencyMs }", Boolean(body) && "ok" in body && "latencyMs" in body);
}

// -------------------------------------------------------------------
// 5. The product still works.
//
// This feature is additive, and the one thing that would make shipping it
// a mistake is breaking a page a paying customer uses. A root error.tsx
// was added in this change, so the marketing and auth routes are checked
// explicitly.
// -------------------------------------------------------------------
console.log("\nproduct routes (regression)");
for (const [path, expected] of [
  // `/` 307s to the marketing site — pre-existing behaviour, verified
  // against production before this change. Not a regression.
  ["/", [200, 307, 308]],
  ["/login", [200]],
  ["/signup", [200]],
  ["/api/keepalive", [200]],
  ["/dashboard", [200, 302, 307]], // redirects when signed out
]) {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
  check(`${path} → ${expected.join("/")}`, expected.includes(res.status), `got ${res.status}`);
}

// -------------------------------------------------------------------
stopServer();

console.log(`\n${passes} passed, ${failures} failed\n`);
process.exit(failures === 0 ? 1 && 0 : 1);
