// Unit tests for the operational arithmetic — uptime and MRR.
//
// Same runner and same constraints as core.pure.test.ts: node:test with
// native type stripping, relative extension-qualified imports, no new
// dependencies.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  computeUptime,
  countErrorsSince,
  computeMrr,
  monthlyEurOfItem,
  type HealthCheckLite,
  type SubscriptionLite,
} from "../ops.pure.ts";

const NOW = "2026-08-07T12:00:00Z";

/** A run of pings every `everyMin` minutes going back `hours` hours. */
function series(hours: number, everyMin: number, ok = true): HealthCheckLite[] {
  const end = new Date(NOW).getTime();
  const out: HealthCheckLite[] = [];
  for (let t = end - hours * 3_600_000; t <= end; t += everyMin * 60_000) {
    out.push({ checkedAt: new Date(t).toISOString(), ok, latencyMs: 40 });
  }
  return out;
}

// -------------------------------------------------------------------
describe("computeUptime", () => {
  test("an unbroken series of pings is 100%", () => {
    const result = computeUptime(series(24, 5), {
      now: NOW,
      windowHours: 24,
      intervalMinutes: 5,
    });
    assert.ok(result);
    assert.equal(result.uptimePct, 100);
    assert.equal(result.failed, 0);
  });

  test("a gap in the series is an outage, even though the missing rows do not exist", () => {
    // This is the whole point of the design. Drop two hours out of the
    // middle: nothing in the table says "down", the rows are simply
    // absent, and uptime must still fall by ~8.3% (2h of 24h).
    const full = series(24, 5);
    const gapStart = new Date(NOW).getTime() - 10 * 3_600_000;
    const gapEnd = gapStart + 2 * 3_600_000;
    const withGap = full.filter((c) => {
      const t = new Date(c.checkedAt).getTime();
      return t < gapStart || t > gapEnd;
    });

    const result = computeUptime(withGap, {
      now: NOW,
      windowHours: 24,
      intervalMinutes: 5,
    });
    assert.ok(result);
    assert.ok(
      result.uptimePct > 90 && result.uptimePct < 93,
      `expected ~91.7%, got ${result.uptimePct}`,
    );
  });

  test("a ping that arrived but reported a dead database is not uptime", () => {
    const checks = [...series(2, 5, true), ...series(1, 5, false)];
    const result = computeUptime(checks, {
      now: NOW,
      windowHours: 24,
      intervalMinutes: 5,
    });
    assert.ok(result);
    assert.ok(result.failed > 0);
    // Failed pings are counted in `failed`, never in `received`.
    assert.ok(result.received < checks.length);
  });

  test("day one of monitoring does not report 4% uptime", () => {
    // Only one hour of history exists against a 24h window. Measuring
    // against the full window would give ~4%; the honest answer is 100%
    // over the one hour we can actually speak for.
    const result = computeUptime(series(1, 5), {
      now: NOW,
      windowHours: 24,
      intervalMinutes: 5,
    });
    assert.ok(result);
    assert.equal(result.uptimePct, 100);
    assert.ok(
      result.measuredHours <= 1.2,
      `measured window should be ~1h, got ${result.measuredHours}`,
    );
  });

  test("an early-firing scheduler cannot push uptime above 100%", () => {
    // GitHub Actions cron drifts; occasionally two pings land inside one
    // interval. That must not read as 104% uptime.
    const dense = series(24, 4);
    const result = computeUptime(dense, {
      now: NOW,
      windowHours: 24,
      intervalMinutes: 5,
    });
    assert.ok(result);
    assert.equal(result.uptimePct, 100);
  });

  test("no data at all returns null, not zero", () => {
    // Zero would render as "0% uptime — everything is down". Null lets
    // the card say "not connected yet".
    assert.equal(
      computeUptime([], { now: NOW, windowHours: 24, intervalMinutes: 5 }),
      null,
    );
  });

  test("checks older than the window are ignored", () => {
    const old: HealthCheckLite[] = [
      { checkedAt: "2026-07-01T00:00:00Z", ok: true, latencyMs: 10 },
    ];
    assert.equal(
      computeUptime(old, { now: NOW, windowHours: 24, intervalMinutes: 5 }),
      null,
    );
  });

  test("median latency comes from the checks in the window", () => {
    const result = computeUptime(
      [
        { checkedAt: NOW, ok: true, latencyMs: 10 },
        { checkedAt: NOW, ok: true, latencyMs: 30 },
        { checkedAt: NOW, ok: true, latencyMs: 200 },
      ],
      { now: NOW, windowHours: 24, intervalMinutes: 5 },
    );
    assert.ok(result);
    assert.equal(result.medianLatencyMs, 30);
  });
});

// -------------------------------------------------------------------
describe("countErrorsSince", () => {
  test("counts only what falls inside the window", () => {
    const errors = [
      { occurredAt: "2026-08-07T11:00:00Z" }, // 1h ago
      { occurredAt: "2026-08-06T13:00:00Z" }, // 23h ago
      { occurredAt: "2026-08-05T13:00:00Z" }, // 47h ago — out
    ];
    assert.equal(countErrorsSince(errors, { now: NOW, hours: 24 }), 2);
  });

  test("junk timestamps do not inflate the count", () => {
    assert.equal(
      countErrorsSince([{ occurredAt: "not a date" }], { now: NOW, hours: 24 }),
      0,
    );
  });
});

// -------------------------------------------------------------------
describe("monthlyEurOfItem", () => {
  test("a monthly price passes through unchanged", () => {
    assert.equal(
      monthlyEurOfItem({
        unitAmount: 2500,
        currency: "eur",
        interval: "month",
        intervalCount: 1,
        quantity: 1,
      }),
      25,
    );
  });

  test("a yearly price is spread across twelve months", () => {
    assert.equal(
      monthlyEurOfItem({
        unitAmount: 24000,
        currency: "eur",
        interval: "year",
        intervalCount: 1,
        quantity: 1,
      }),
      20,
    );
  });

  test("a three-month interval divides by three", () => {
    // €90 charged quarterly is €30/mo, not €90/mo. Missing intervalCount
    // is the classic way to triple your own MRR.
    assert.equal(
      monthlyEurOfItem({
        unitAmount: 9000,
        currency: "eur",
        interval: "month",
        intervalCount: 3,
        quantity: 1,
      }),
      30,
    );
  });

  test("quantity multiplies", () => {
    assert.equal(
      monthlyEurOfItem({
        unitAmount: 2500,
        currency: "eur",
        interval: "month",
        intervalCount: 1,
        quantity: 4,
      }),
      100,
    );
  });

  test("an unpriced or unknown-interval item contributes nothing", () => {
    assert.equal(
      monthlyEurOfItem({
        unitAmount: null,
        currency: "eur",
        interval: "month",
        intervalCount: 1,
        quantity: 1,
      }),
      0,
    );
    assert.equal(
      monthlyEurOfItem({
        unitAmount: 1000,
        currency: "eur",
        interval: "fortnight",
        intervalCount: 1,
        quantity: 1,
      }),
      0,
    );
  });
});

// -------------------------------------------------------------------
describe("computeMrr", () => {
  const eurMonthly = (cents: number): SubscriptionLite["items"] => [
    { unitAmount: cents, currency: "eur", interval: "month", intervalCount: 1, quantity: 1 },
  ];

  test("sums active subscriptions", () => {
    const result = computeMrr([
      { status: "active", items: eurMonthly(2500) },
      { status: "active", items: eurMonthly(5900) },
    ]);
    assert.equal(result.mrr, 84);
    assert.equal(result.counted, 2);
  });

  test("trials and past-due subscriptions are excluded", () => {
    // Counting a trial as revenue is how a dashboard ends up lying to
    // the person relying on it.
    const result = computeMrr([
      { status: "active", items: eurMonthly(2500) },
      { status: "trialing", items: eurMonthly(9900) },
      { status: "past_due", items: eurMonthly(9900) },
      { status: "canceled", items: eurMonthly(9900) },
    ]);
    assert.equal(result.mrr, 25);
    assert.equal(result.counted, 1);
  });

  test("a foreign-currency subscription is reported, not silently converted", () => {
    const result = computeMrr([
      { status: "active", items: eurMonthly(2500) },
      {
        status: "active",
        items: [
          { unitAmount: 3000, currency: "usd", interval: "month", intervalCount: 1, quantity: 1 },
        ],
      },
    ]);
    assert.equal(result.mrr, 25);
    assert.equal(result.counted, 1);
    assert.equal(result.skippedForeignCurrency, 1);
  });

  test("mixed intervals normalise to one monthly figure", () => {
    const result = computeMrr([
      { status: "active", items: eurMonthly(2500) },
      {
        status: "active",
        items: [
          { unitAmount: 24000, currency: "eur", interval: "year", intervalCount: 1, quantity: 1 },
        ],
      },
    ]);
    assert.equal(result.mrr, 45);
  });

  test("no active subscriptions is zero, not a crash", () => {
    const result = computeMrr([]);
    assert.equal(result.mrr, 0);
    assert.equal(result.counted, 0);
  });
});
