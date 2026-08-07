// Pure arithmetic for the operational cards: uptime, error rate, MRR.
//
// Same rule as core.pure.ts — no Supabase, no fetch, no `Date.now()`
// hidden inside. Everything takes `now` as an argument so it can be
// tested without freezing the clock. This is where the numbers she makes
// decisions from are actually computed, so it is the part that has to be
// under test.

// -------------------------------------------------------------------
// Uptime
// -------------------------------------------------------------------

export type HealthCheckLite = {
  checkedAt: string;
  ok: boolean;
  latencyMs?: number | null;
};

export type UptimeWindow = {
  /** 0–100, one decimal place. */
  uptimePct: number;
  /** Pings we should have seen over `measuredHours`. */
  expected: number;
  /** Pings that arrived AND reported a healthy database. */
  received: number;
  /** Pings that arrived but reported a failure (app up, DB down). */
  failed: number;
  /** The window that was asked for. */
  windowHours: number;
  /**
   * The window actually covered by data. Smaller than `windowHours` for
   * the first day after monitoring is switched on — without this the
   * card would read "4% uptime" on day one, which is a lie about the
   * service rather than a statement about the data.
   */
  measuredHours: number;
  medianLatencyMs: number | null;
};

/**
 * Uptime from a series of synthetic probe results.
 *
 * The key idea: a missing row is the signal. A health-check row can only
 * be written by a live app talking to a live database, so uptime is
 *
 *     pings that arrived / pings that should have arrived
 *
 * and NOT "share of rows whose ok flag is true" — that second definition
 * reports a serene 100% for the entire duration of an outage, because a
 * dead app writes no rows at all.
 *
 * Returns null when there is nothing to measure, so the caller can show
 * an honest "not connected yet" instead of a zero.
 */
export function computeUptime(
  checks: HealthCheckLite[],
  opts: {
    now: Date | string | number;
    windowHours: number;
    /** How often the pinger is scheduled to run. */
    intervalMinutes: number;
  },
): UptimeWindow | null {
  const now = new Date(opts.now).getTime();
  const windowMs = opts.windowHours * 3_600_000;
  const intervalMs = Math.max(1, opts.intervalMinutes) * 60_000;
  const windowStart = now - windowMs;

  const inWindow = checks
    .map((c) => ({ ...c, t: new Date(c.checkedAt).getTime() }))
    .filter((c) => Number.isFinite(c.t) && c.t >= windowStart && c.t <= now + 60_000)
    .sort((a, b) => a.t - b.t);

  if (inWindow.length === 0) return null;

  // Measure from the first ping we have, not from the start of the
  // window, when monitoring has been running for less than the window.
  const firstAt = inWindow[0].t;
  const measuredMs = Math.max(intervalMs, now - Math.max(windowStart, firstAt - intervalMs));
  const expected = Math.max(1, Math.round(measuredMs / intervalMs));

  const received = inWindow.filter((c) => c.ok).length;
  const failed = inWindow.length - received;

  const latencies = inWindow
    .map((c) => c.latencyMs)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0)
    .sort((a, b) => a - b);

  return {
    // Capped at 100: a scheduler that fires a little early (GitHub Actions
    // cron drifts) would otherwise produce 103%.
    uptimePct: round1(Math.min(100, (received / expected) * 100)),
    expected,
    received,
    failed,
    windowHours: opts.windowHours,
    measuredHours: round1(measuredMs / 3_600_000),
    medianLatencyMs: latencies.length > 0 ? latencies[Math.floor(latencies.length / 2)] : null,
  };
}

/** Errors recorded in the last N hours. A count, not a rate — there is no
 *  request counter in this stack to divide by, and inventing a
 *  denominator would make the number meaningless. */
export function countErrorsSince(
  errors: Array<{ occurredAt: string }>,
  opts: { now: Date | string | number; hours: number },
): number {
  const now = new Date(opts.now).getTime();
  const since = now - opts.hours * 3_600_000;
  return errors.filter((e) => {
    const t = new Date(e.occurredAt).getTime();
    return Number.isFinite(t) && t >= since;
  }).length;
}

// -------------------------------------------------------------------
// MRR
// -------------------------------------------------------------------

export type BillingIntervalName = "day" | "week" | "month" | "year";

export type SubscriptionItemLite = {
  /** Minor units (cents), as Stripe reports them. */
  unitAmount: number | null;
  currency: string;
  interval: string;
  intervalCount: number;
  quantity: number;
};

export type SubscriptionLite = {
  status: string;
  items: SubscriptionItemLite[];
};

export type MrrResult = {
  /** Monthly recurring revenue in euro. */
  mrr: number;
  /** How many subscriptions contributed. */
  counted: number;
  /**
   * Subscriptions skipped because they are priced in a currency this
   * dashboard cannot convert. Surfaced rather than silently folded in at
   * a made-up rate.
   */
  skippedForeignCurrency: number;
};

/** Months per billing period. Year → 12, week → 52/12, day → 365/12. */
const MONTHS_PER_INTERVAL: Record<BillingIntervalName, number> = {
  day: 365 / 12,
  week: 52 / 12,
  month: 1,
  year: 1 / 12,
};

/**
 * Normalise one subscription item to euro per month.
 *
 * Returns 0 for anything unpriced or unrecognised rather than throwing:
 * one odd price in a Stripe account should cost that line its
 * contribution, not blank the whole MRR card.
 */
export function monthlyEurOfItem(item: SubscriptionItemLite): number {
  if (item.unitAmount === null || !Number.isFinite(item.unitAmount)) return 0;
  const factor = MONTHS_PER_INTERVAL[item.interval as BillingIntervalName];
  if (!factor) return 0;
  const count = Number.isFinite(item.intervalCount) && item.intervalCount > 0 ? item.intervalCount : 1;
  const qty = Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1;
  // unitAmount is in cents, and covers `count` intervals.
  return (item.unitAmount / 100) * qty * (factor / count);
}

/**
 * Sum active subscriptions into a monthly figure.
 *
 * Only `active` counts. Trials have not paid and may never pay; counting
 * them is the classic way to build a SaaS dashboard that flatters you.
 * `past_due` is also excluded — the invoice has already failed.
 */
export function computeMrr(
  subscriptions: SubscriptionLite[],
  opts: { currency?: string } = {},
): MrrResult {
  const wanted = (opts.currency ?? "eur").toLowerCase();
  let mrr = 0;
  let counted = 0;
  let skippedForeignCurrency = 0;

  for (const sub of subscriptions) {
    if (sub.status !== "active") continue;

    const usable = sub.items.filter((i) => (i.currency ?? "").toLowerCase() === wanted);
    if (usable.length === 0 && sub.items.length > 0) {
      skippedForeignCurrency += 1;
      continue;
    }

    const total = usable.reduce((sum, i) => sum + monthlyEurOfItem(i), 0);
    if (total > 0) {
      mrr += total;
      counted += 1;
    }
  }

  return { mrr: round2(mrr), counted, skippedForeignCurrency };
}

// -------------------------------------------------------------------

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
