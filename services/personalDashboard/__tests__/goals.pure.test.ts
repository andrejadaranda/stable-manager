// Unit tests for weekly periods and goal forecasting.
//
// Same runner and constraints as the other two suites: node:test with
// native type stripping, relative extension-qualified imports.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  weekBounds,
  weekElapsedFraction,
  forecastGoal,
  goalAdvice,
} from "../core.pure.ts";

const TZ = "Europe/Vilnius";

// -------------------------------------------------------------------
describe("weekBounds", () => {
  test("a Friday resolves to the Monday of that week", () => {
    // 2026-08-07 is a Friday.
    const w = weekBounds(new Date("2026-08-07T10:00:00Z"), TZ);
    assert.equal(w.startKey, "2026-08-03");
    assert.equal(w.dayOfWeek, 5);
  });

  test("Monday is the start of its own week, not the previous one", () => {
    const w = weekBounds(new Date("2026-08-03T08:00:00Z"), TZ);
    assert.equal(w.startKey, "2026-08-03");
    assert.equal(w.dayOfWeek, 1);
  });

  test("Sunday belongs to the week that started six days earlier", () => {
    // The Sunday-first bug: JS getUTCDay() returns 0 here, and a naive
    // conversion would make Sunday start a brand new week — moving every
    // weekly goal a day out and resetting progress a day early.
    const w = weekBounds(new Date("2026-08-09T12:00:00Z"), TZ);
    assert.equal(w.startKey, "2026-08-03");
    assert.equal(w.dayOfWeek, 7);
  });

  test("the week boundary follows the stable's timezone, not UTC", () => {
    // 21:30 UTC on Sunday 9 Aug is already Monday 10 Aug in Vilnius
    // (UTC+3 in summer), so this belongs to the NEXT week.
    const w = weekBounds(new Date("2026-08-09T21:30:00Z"), TZ);
    assert.equal(w.startKey, "2026-08-10");
    assert.equal(w.dayOfWeek, 1);
  });

  test("a week spanning a month boundary still starts on its Monday", () => {
    // Tuesday 1 Sept 2026; the week started Monday 31 Aug.
    const w = weekBounds(new Date("2026-09-01T09:00:00Z"), TZ);
    assert.equal(w.startKey, "2026-08-31");
  });

  test("endISO is exactly seven days after startISO", () => {
    const w = weekBounds(new Date("2026-08-07T10:00:00Z"), TZ);
    const span = new Date(w.endISO).getTime() - new Date(w.startISO).getTime();
    assert.equal(span, 7 * 86_400_000);
  });
});

describe("weekElapsedFraction", () => {
  test("Monday counts as one day gone, not zero", () => {
    // Zero would make every weekly goal read "on track" all Monday.
    assert.ok(Math.abs(weekElapsedFraction(1) - 1 / 7) < 1e-9);
  });

  test("Sunday is the full week", () => {
    assert.equal(weekElapsedFraction(7), 1);
  });
});

// -------------------------------------------------------------------
describe("forecastGoal", () => {
  test("half the period at half the target projects exactly the target", () => {
    const f = forecastGoal({
      actual: 1500,
      target: 3000,
      elapsedFraction: 0.5,
      daysTotal: 30,
      daysElapsed: 15,
    });
    assert.equal(f.projected, 3000);
    assert.equal(f.willHit, true);
    assert.equal(f.remaining, 1500);
    assert.equal(f.daysRemaining, 15);
    assert.equal(f.perDayNeeded, 100);
  });

  test("a slow start projects a miss", () => {
    const f = forecastGoal({
      actual: 1000,
      target: 3000,
      elapsedFraction: 0.5,
      daysTotal: 30,
      daysElapsed: 15,
    });
    assert.equal(f.projected, 2000);
    assert.equal(f.willHit, false);
  });

  test("day one does not project infinity", () => {
    // actual / elapsed with elapsed ≈ 0 is Infinity, and a card reading
    // "projected: ∞" is the fastest way to lose trust in the number.
    const f = forecastGoal({
      actual: 0,
      target: 3000,
      elapsedFraction: 0.01,
      daysTotal: 30,
      daysElapsed: 0,
    });
    assert.ok(Number.isFinite(f.projected));
    assert.equal(f.projected, 0);
  });

  test("an early burst is not extrapolated into a fantasy", () => {
    // €500 on day 2 of 30 would extrapolate to €7500. Below a tenth of
    // the period elapsed, no extrapolation is attempted at all.
    const f = forecastGoal({
      actual: 500,
      target: 3000,
      elapsedFraction: 2 / 30,
      daysTotal: 30,
      daysElapsed: 2,
    });
    assert.equal(f.projected, 500);
  });

  test("remaining never goes negative once the target is beaten", () => {
    const f = forecastGoal({
      actual: 3500,
      target: 3000,
      elapsedFraction: 0.9,
      daysTotal: 30,
      daysElapsed: 27,
    });
    assert.equal(f.remaining, 0);
    assert.equal(f.perDayNeeded, 0);
    assert.equal(f.willHit, true);
  });

  test("a met target counts as hit even if the pace has since collapsed", () => {
    const f = forecastGoal({
      actual: 3000,
      target: 3000,
      elapsedFraction: 1,
      daysTotal: 30,
      daysElapsed: 30,
    });
    assert.equal(f.willHit, true);
    assert.equal(f.perDayNeeded, null);
    assert.equal(f.daysRemaining, 0);
  });

  test("the last day does not divide by zero", () => {
    const f = forecastGoal({
      actual: 2000,
      target: 3000,
      elapsedFraction: 1,
      daysTotal: 30,
      daysElapsed: 30,
    });
    assert.equal(f.perDayNeeded, null);
    assert.equal(f.daysRemaining, 0);
  });
});

// -------------------------------------------------------------------
describe("goalAdvice", () => {
  const forecastFor = (actual: number, target: number) =>
    forecastGoal({
      actual,
      target,
      elapsedFraction: 0.5,
      daysTotal: 30,
      daysElapsed: 15,
    });

  test("behind pace names the gap and the daily rate needed", () => {
    const text = goalAdvice({
      actual: 1000,
      target: 3000,
      unit: "eur",
      forecast: forecastFor(1000, 3000),
      period: "month",
    });
    assert.match(text, /trūksta/);
    assert.match(text, /per dieną/);
    assert.match(text, /15 dienos/);
  });

  test("on pace says so without a scolding", () => {
    const text = goalAdvice({
      actual: 1600,
      target: 3000,
      unit: "eur",
      forecast: forecastFor(1600, 3000),
      period: "month",
    });
    assert.match(text, /bus įvykdytas/);
    assert.doesNotMatch(text, /trūksta/);
  });

  test("an achieved goal is congratulated, not nagged", () => {
    const text = goalAdvice({
      actual: 3200,
      target: 3000,
      unit: "eur",
      forecast: forecastFor(3200, 3000),
      period: "month",
    });
    assert.match(text, /Pasiekta/);
  });

  test("no target set is said plainly rather than divided by zero", () => {
    const text = goalAdvice({
      actual: 0,
      target: 0,
      unit: "count",
      forecast: forecastFor(0, 0),
      period: "week",
    });
    assert.equal(text, "Tikslas nenustatytas.");
  });

  test("a finished period is reported in the past tense", () => {
    const text = goalAdvice({
      actual: 2400,
      target: 3000,
      unit: "eur",
      forecast: forecastGoal({
        actual: 2400,
        target: 3000,
        elapsedFraction: 1,
        daysTotal: 30,
        daysElapsed: 30,
      }),
      period: "month",
    });
    assert.match(text, /baigėsi/);
    assert.match(text, /Trūko/);
  });

  test("the period is named correctly for a weekly goal", () => {
    const text = goalAdvice({
      actual: 5,
      target: 20,
      unit: "count",
      forecast: forecastGoal({
        actual: 5,
        target: 20,
        elapsedFraction: 0.5,
        daysTotal: 7,
        daysElapsed: 4,
      }),
      period: "week",
    });
    assert.match(text, /šią savaitę/);
  });

  test("counts are not formatted as euro", () => {
    const text = goalAdvice({
      actual: 5,
      target: 20,
      unit: "count",
      forecast: forecastFor(5, 20),
      period: "month",
    });
    assert.doesNotMatch(text, /€/);
  });
});
