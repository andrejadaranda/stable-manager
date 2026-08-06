// Unit tests for the personal dashboard's pure logic.
//
// Runner: Node's built-in `node:test` plus native TypeScript type
// stripping — `npm run test:personal`. No Jest, no Vitest, no ts-node,
// no new dependencies, and nothing added to the production bundle.
//
// This repo had no JavaScript test runner before this change (the only
// existing tests are pgTAP-style SQL plans under database/tests/), so
// this is the smallest possible footprint that still gets the risky
// arithmetic under test. The imports are relative and extension-qualified
// because Node resolves them directly — the `@/` alias is a bundler
// feature and doesn't exist here. That's also why only `*.pure.ts`
// modules are testable this way: everything else reaches for Supabase.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  daysBetween,
  localDateKey,
  monthBounds,
  quarterStartKey,
  classifyRecency,
  suggestOutreachMessage,
  buildReengagementList,
  goalProgress,
  monthElapsedFraction,
  forecastMonth,
  detectContentGaps,
  topPosts,
  formatEur,
  REENGAGEMENT_DAYS,
  type ClientRecency,
  type SocialPostLite,
} from "../core.pure.ts";

const TZ = "Europe/Vilnius";

// -------------------------------------------------------------------
describe("time helpers", () => {
  test("localDateKey renders the stable's local calendar date", () => {
    // 22:30 UTC on 14 Aug is already 15 Aug in Vilnius (UTC+3 in summer).
    // Getting this wrong is what makes a lesson land on the wrong day.
    assert.equal(localDateKey("2026-08-14T22:30:00Z", TZ), "2026-08-15");
    assert.equal(localDateKey("2026-08-14T20:59:00Z", TZ), "2026-08-14");
  });

  test("daysBetween counts calendar days, not 24h blocks", () => {
    assert.equal(daysBetween("2026-08-01T23:00:00Z", "2026-08-02T01:00:00Z", TZ), 0);
    assert.equal(daysBetween("2026-08-01T10:00:00Z", "2026-08-15T09:00:00Z", TZ), 14);
  });

  test("daysBetween is stable across a DST transition", () => {
    // Vilnius leaves DST on 2026-10-25. A naive ms/86400000 division
    // returns 30.96 days here and floors to 30.
    assert.equal(daysBetween("2026-10-10T12:00:00Z", "2026-11-10T12:00:00Z", TZ), 31);
  });

  test("monthBounds reports the right day-of-month and month length", () => {
    const feb = monthBounds(new Date("2026-02-17T09:00:00Z"), TZ);
    assert.equal(feb.startKey, "2026-02-01");
    assert.equal(feb.daysInMonth, 28);
    assert.equal(feb.dayOfMonth, 17);

    // 2028 is a leap year — the length must follow the actual calendar.
    const leap = monthBounds(new Date("2028-02-05T09:00:00Z"), TZ);
    assert.equal(leap.daysInMonth, 29);
  });

  test("quarterStartKey snaps to the quarter's first month", () => {
    assert.equal(quarterStartKey(new Date("2026-08-07T09:00:00Z"), TZ), "2026-07-01");
    assert.equal(quarterStartKey(new Date("2026-01-31T09:00:00Z"), TZ), "2026-01-01");
    assert.equal(quarterStartKey(new Date("2026-12-31T09:00:00Z"), TZ), "2026-10-01");
  });
});

// -------------------------------------------------------------------
describe("re-engagement — 'jei nejojo 2 sav jau kviesti'", () => {
  test("the threshold is exactly 14 days", () => {
    assert.equal(REENGAGEMENT_DAYS, 14);
    assert.equal(classifyRecency(13, false, 5), "ok");
    assert.equal(classifyRecency(14, false, 5), "due");
    assert.equal(classifyRecency(27, false, 5), "due");
    assert.equal(classifyRecency(28, false, 5), "overdue");
  });

  test("a client with a lesson already booked is never chased", () => {
    // The list has to stay short enough to actually get worked.
    assert.equal(classifyRecency(90, true, 5), "ok");
  });

  test("a client who has never ridden is flagged, not ignored", () => {
    assert.equal(classifyRecency(null, false, 0), "never");
  });

  test("a lapsed client with history but no last-ride date isn't invented into the list", () => {
    assert.equal(classifyRecency(null, false, 3), "ok");
  });

  test("suggested messages are Lithuanian, first-name only, and quote the gap", () => {
    const msg = suggestOutreachMessage("Justė Petrauskaitė", "due", 21);
    assert.match(msg, /Justė/);
    assert.doesNotMatch(msg, /Petrauskaitė/);
    assert.match(msg, /21 d\./);

    const never = suggestOutreachMessage("Emma", "never", null);
    assert.match(never, /pirmos treniruotės/);
    // A null gap must never render as "null d." in a message she sends.
    assert.doesNotMatch(never, /null/);
  });

  test("the list is ordered longest-silence-first, overdue before due before never", () => {
    const now = new Date("2026-08-07T12:00:00Z");
    const clients: ClientRecency[] = [
      c("a", "Ana", "2026-07-20T10:00:00Z", 4),          // 18 days -> due
      c("b", "Beata", "2026-05-01T10:00:00Z", 9),         // 98 days -> overdue
      c("c", "Cilė", null, 0),                             // never
      c("d", "Dovilė", "2026-08-05T10:00:00Z", 2),        // 2 days -> ok, drops out
      c("e", "Eglė", "2026-06-20T10:00:00Z", 6),          // 48 days -> overdue
    ];

    const rows = buildReengagementList(clients, now, TZ);
    assert.deepEqual(rows.map((r) => r.fullName), ["Beata", "Eglė", "Ana", "Cilė"]);
    assert.equal(rows[0].tone, "overdue");
    assert.equal(rows[3].tone, "never");
  });

  test("a booked follow-up removes a long-silent client from the list", () => {
    const now = new Date("2026-08-07T12:00:00Z");
    const booked: ClientRecency = {
      ...c("x", "Rūta", "2026-05-01T10:00:00Z", 7),
      nextRideAt: "2026-08-09T10:00:00Z",
    };
    assert.equal(buildReengagementList([booked], now, TZ).length, 0);
  });

  test("dismissed clients drop out entirely", () => {
    const now = new Date("2026-08-07T12:00:00Z");
    const clients = [c("a", "Ana", "2026-05-01T10:00:00Z", 4)];
    assert.equal(buildReengagementList(clients, now, TZ).length, 1);
    assert.equal(buildReengagementList(clients, now, TZ, new Set(["a"])).length, 0);
  });
});

function c(
  id: string,
  name: string,
  lastRide: string | null,
  lessons: number,
): ClientRecency {
  return {
    clientId: id,
    fullName: name,
    phone: "+37060000000",
    email: null,
    lastRideAt: lastRide,
    lessonsCompleted: lessons,
    nextRideAt: null,
  };
}

// -------------------------------------------------------------------
describe("goal pacing", () => {
  test("status is judged against elapsed time, not raw percentage", () => {
    // 60% of the goal is 'ahead' on the 10th...
    assert.equal(goalProgress(600, 1000, 10 / 31).status, "ahead");
    // ...and 'behind' on the 28th. A bare percentage can't tell these apart.
    assert.equal(goalProgress(600, 1000, 28 / 31).status, "behind");
  });

  test("the ±10% tolerance band keeps one quiet day from flipping the board", () => {
    assert.equal(goalProgress(500, 1000, 0.5).status, "on_track");
    assert.equal(goalProgress(455, 1000, 0.5).status, "on_track");  // -9%
    assert.equal(goalProgress(440, 1000, 0.5).status, "behind");    // -12%
    assert.equal(goalProgress(560, 1000, 0.5).status, "ahead");     // +12%
  });

  test("hitting the target is always 'ahead', whatever the date", () => {
    assert.equal(goalProgress(1000, 1000, 0.1).status, "ahead");
    assert.equal(goalProgress(1200, 1000, 1).status, "ahead");
  });

  test("day one is never 'behind'", () => {
    assert.equal(goalProgress(0, 1000, 0).status, "on_track");
  });

  test("a missing or zero target reports no_target rather than dividing by zero", () => {
    const p = goalProgress(500, 0, 0.5);
    assert.equal(p.status, "no_target");
    assert.equal(p.ratio, 0);
    assert.ok(Number.isFinite(p.ratio));
  });

  test("ratio is uncapped so overachievement stays visible", () => {
    assert.equal(goalProgress(1300, 1000, 1).ratio, 1.3);
  });

  test("paceDelta signs the gap against the linear pace", () => {
    assert.equal(goalProgress(400, 1000, 0.5).paceDelta, -100);
    assert.equal(goalProgress(600, 1000, 0.5).paceDelta, 100);
  });

  test("elapsed fraction is clamped to [0,1]", () => {
    assert.equal(monthElapsedFraction(0, 31), 0);
    assert.equal(monthElapsedFraction(31, 31), 1);
    assert.equal(monthElapsedFraction(45, 31), 1);
    assert.equal(monthElapsedFraction(5, 0), 0);
  });
});

// -------------------------------------------------------------------
describe("revenue forecasting", () => {
  test("booked forecast counts only what's actually in the calendar", () => {
    const f = forecastMonth({
      earnedToDate: 800,
      outstanding: 200,
      booked: 500,
      dayOfMonth: 10,
      daysInMonth: 30,
    });
    assert.equal(f.bookedForecast, 1500);
  });

  test("pace forecast extrapolates delivered value, not cash collected", () => {
    // 1000 delivered over 10 of 30 days -> 3000 at the same rate.
    const f = forecastMonth({
      earnedToDate: 800,
      outstanding: 200,
      booked: 0,
      dayOfMonth: 10,
      daysInMonth: 30,
    });
    assert.equal(f.paceForecast, 3000);
  });

  test("day zero doesn't divide by zero", () => {
    const f = forecastMonth({
      earnedToDate: 0,
      outstanding: 0,
      booked: 0,
      dayOfMonth: 0,
      daysInMonth: 31,
    });
    assert.equal(f.paceForecast, 0);
    assert.ok(Number.isFinite(f.paceForecast));
  });
});

// -------------------------------------------------------------------
describe("content gap detection", () => {
  const now = new Date("2026-08-07T12:00:00Z");

  test("no posts means no invented insights", () => {
    assert.deepEqual(detectContentGaps([], now, TZ), []);
  });

  test("a week of silence is flagged, escalating after two", () => {
    const oneWeek = detectContentGaps([post("2026-07-31T10:00:00Z", "image")], now, TZ);
    assert.equal(oneWeek.find((g) => g.id === "silence")?.severity, "medium");

    const twoWeeks = detectContentGaps([post("2026-07-20T10:00:00Z", "image")], now, TZ);
    assert.equal(twoWeeks.find((g) => g.id === "silence")?.severity, "high");
  });

  test("a week of photos with no video is flagged", () => {
    const gaps = detectContentGaps(
      [post("2026-08-05T10:00:00Z", "image"), post("2026-08-03T10:00:00Z", "carousel")],
      now,
      TZ,
    );
    assert.ok(gaps.some((g) => g.id === "no-video"));
  });

  test("a reel counts as video", () => {
    const gaps = detectContentGaps(
      [post("2026-08-05T10:00:00Z", "reel"), post("2026-08-03T10:00:00Z", "image")],
      now,
      TZ,
    );
    assert.ok(!gaps.some((g) => g.id === "no-video"));
  });

  test("a sustained engagement drop is flagged", () => {
    const recent = [1, 3, 5].map((d) => post(`2026-08-0${d}T10:00:00Z`, "reel", 5));
    const previous = [1, 3, 5].map((d) => post(`2026-07-0${d}T10:00:00Z`, "reel", 60));
    const gaps = detectContentGaps([...recent, ...previous], now, TZ);
    assert.ok(gaps.some((g) => g.id === "engagement-drop"));
  });

  test("too little history means no drop claim", () => {
    const gaps = detectContentGaps(
      [post("2026-08-05T10:00:00Z", "reel", 5), post("2026-07-05T10:00:00Z", "reel", 60)],
      now,
      TZ,
    );
    assert.ok(!gaps.some((g) => g.id === "engagement-drop"));
  });

  test("topPosts ranks by total engagement and respects the limit", () => {
    const posts = [
      post("2026-08-01T10:00:00Z", "image", 10),
      post("2026-08-02T10:00:00Z", "reel", 90),
      post("2026-08-03T10:00:00Z", "image", 40),
    ];
    const top = topPosts(posts, 2);
    assert.equal(top.length, 2);
    assert.equal(top[0].likes, 90);
    assert.equal(top[1].likes, 40);
  });
});

function post(postedAt: string, mediaType: string, likes = 10): SocialPostLite {
  return { platform: "instagram", mediaType, postedAt, likes, comments: 0, reach: 0 };
}

// -------------------------------------------------------------------
describe("formatting", () => {
  test("euro amounts use the Lithuanian convention", () => {
    const s = formatEur(1234);
    assert.match(s, /1/);
    assert.match(s, /€/);
    // Lithuanian formatting must not produce the US "$1,234.00" shape.
    assert.doesNotMatch(s, /\$/);
  });
});
