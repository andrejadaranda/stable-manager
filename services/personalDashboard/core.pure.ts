// Pure logic for the personal command centre.
//
// Everything here is a plain function of its arguments — no Supabase, no
// clock, no env. `now` is always injected. That is what makes this file
// the one part of the dashboard with real unit tests (see
// services/personalDashboard/__tests__), and it follows the existing
// repo convention of splitting testable logic into `*.pure.ts`
// (billing.pure.ts, availability.pure.ts, horseBalance.pure.ts …).

// -------------------------------------------------------------------
// Time helpers — timezone-correct without pulling in a date library.
// -------------------------------------------------------------------
// The stable's timezone matters here. "Days since last ride" computed in
// UTC is wrong by a day for a Vilnius evening lesson (EEST = UTC+3), and
// being a day off is the difference between a client showing up on the
// "call them" list or not.

export type DateParts = { year: number; month: number; day: number };

/** Calendar date in a given IANA timezone, as numbers. */
export function localDateParts(at: Date | string, timeZone: string): DateParts {
  const d = typeof at === "string" ? new Date(at) : at;
  // en-CA formats as YYYY-MM-DD, which parses without ambiguity.
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const [year, month, day] = s.split("-").map(Number);
  return { year, month, day };
}

/** "YYYY-MM-DD" for a timestamp, in the given timezone. */
export function localDateKey(at: Date | string, timeZone: string): string {
  const { year, month, day } = localDateParts(at, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Whole days between two instants, counted as calendar days in `timeZone`. */
export function daysBetween(
  earlier: Date | string,
  later: Date | string,
  timeZone: string,
): number {
  const a = localDateParts(earlier, timeZone);
  const b = localDateParts(later, timeZone);
  // Compare as UTC midnights of the *local* calendar dates so DST
  // transitions can't produce a 0.96-day or 1.04-day result.
  const au = Date.UTC(a.year, a.month - 1, a.day);
  const bu = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((bu - au) / 86_400_000);
}

/** First and last instant of the calendar month containing `now`. */
export function monthBounds(
  now: Date,
  timeZone: string,
): { startISO: string; endISO: string; startKey: string; daysInMonth: number; dayOfMonth: number } {
  const { year, month, day } = localDateParts(now, timeZone);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // Building the boundary from the local wall-clock date and letting the
  // DB compare in UTC is close enough for a ±3h offset: the query filters
  // on >= start and < next-start, and both are derived the same way.
  const startKey = `${year}-${String(month).padStart(2, "0")}-01`;
  const start = new Date(`${startKey}T00:00:00`);
  const end = new Date(Date.UTC(year, month, 1));
  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    startKey,
    daysInMonth,
    dayOfMonth: day,
  };
}

/** First day (YYYY-MM-01) of the quarter containing `now`. */
export function quarterStartKey(now: Date, timeZone: string): string {
  const { year, month } = localDateParts(now, timeZone);
  const qMonth = Math.floor((month - 1) / 3) * 3 + 1;
  return `${year}-${String(qMonth).padStart(2, "0")}-01`;
}

// -------------------------------------------------------------------
// Re-engagement — "jei nejojo 2 sav jau kviesti"
// -------------------------------------------------------------------

/** Her rule, stated once, in one place. */
export const REENGAGEMENT_DAYS = 14;

export type ReengagementTone = "never" | "overdue" | "due" | "ok";

export type ClientRecency = {
  clientId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  lastRideAt: string | null;
  lessonsCompleted: number;
  nextRideAt: string | null;
};

export type ReengagementRow = ClientRecency & {
  /** null when they have never had a completed lesson. */
  daysSince: number | null;
  tone: ReengagementTone;
  suggestedMessage: string;
};

/**
 * Bucket a client by riding recency.
 *
 * A client with a lesson already on the books is never "due" — she has
 * no reason to chase someone who is booked in for Thursday, and a list
 * that nags about them is a list she stops reading.
 */
export function classifyRecency(
  daysSince: number | null,
  hasUpcoming: boolean,
  lessonsCompleted: number,
): ReengagementTone {
  if (hasUpcoming) return "ok";
  // Never rode, but is on the books as a client — worth a call, and
  // arguably the most valuable call on the list.
  if (daysSince === null) return lessonsCompleted === 0 ? "never" : "ok";
  if (daysSince >= REENGAGEMENT_DAYS * 2) return "overdue";
  if (daysSince >= REENGAGEMENT_DAYS) return "due";
  return "ok";
}

/**
 * Draft the outreach message. Lithuanian, warm, and specific — a generic
 * "hi, come ride" is the kind of thing she'd rewrite every time, which
 * would make the feature useless.
 *
 * Returns the message body only; the UI wraps it in an sms:/wa.me link.
 */
export function suggestOutreachMessage(
  fullName: string,
  tone: ReengagementTone,
  daysSince: number | null,
): string {
  // First name only — full names read like an invoice.
  const first = fullName.trim().split(/\s+/)[0] || fullName;

  switch (tone) {
    case "never":
      return `Sveiki, ${first}! Matau, kad dar nespėjome suplanuoti pirmos treniruotės. Turiu laisvų laikų šią savaitę — norite užsirašyti?`;
    case "overdue":
      return `Sveiki, ${first}! Seniai nesimatėme manieže — jau ${daysSince} d. Labai laukiame atgal, turiu gerų laikų šią savaitę. Rezervuoti?`;
    case "due":
      return `Sveiki, ${first}! Praėjo ${daysSince} d. nuo paskutinės treniruotės. Gal norite užsirašyti šią savaitę? Turiu laisvų laikų.`;
    default:
      return `Sveiki, ${first}! Iki greito manieže.`;
  }
}

/**
 * The re-engagement list, ordered the way she'd work it: longest silence
 * first, never-ridden clients folded in just after the truly overdue.
 *
 * `dismissedIds` are clients she has already contacted today — see
 * dashboard_dismissals. They drop out entirely rather than being greyed
 * out; a shorter list gets worked, a long one gets ignored.
 */
export function buildReengagementList(
  clients: ClientRecency[],
  now: Date,
  timeZone: string,
  dismissedIds: ReadonlySet<string> = new Set(),
): ReengagementRow[] {
  const rows: ReengagementRow[] = [];

  for (const c of clients) {
    if (dismissedIds.has(c.clientId)) continue;

    const daysSince =
      c.lastRideAt === null ? null : daysBetween(c.lastRideAt, now, timeZone);
    const hasUpcoming = Boolean(c.nextRideAt);
    const tone = classifyRecency(daysSince, hasUpcoming, c.lessonsCompleted);
    if (tone === "ok") continue;

    rows.push({
      ...c,
      daysSince,
      tone,
      suggestedMessage: suggestOutreachMessage(c.fullName, tone, daysSince),
    });
  }

  // Sort: overdue before due before never; within a bucket, longest gap
  // first. Never-ridden clients have no gap to sort by, so they go last
  // in name order — stable and predictable between refreshes.
  const rank: Record<ReengagementTone, number> = {
    overdue: 0,
    due: 1,
    never: 2,
    ok: 3,
  };
  return rows.sort((a, b) => {
    if (rank[a.tone] !== rank[b.tone]) return rank[a.tone] - rank[b.tone];
    if (a.daysSince !== null && b.daysSince !== null) return b.daysSince - a.daysSince;
    return a.fullName.localeCompare(b.fullName, "lt");
  });
}

// -------------------------------------------------------------------
// Goals
// -------------------------------------------------------------------

export type GoalStatus = "ahead" | "on_track" | "behind" | "no_target";

export type GoalProgress = {
  actual: number;
  target: number;
  /** 0..1, uncapped so 130% of target is visible as 1.3. */
  ratio: number;
  /** Where she *should* be by now if progress were linear across the period. */
  expectedByNow: number;
  status: GoalStatus;
  /** Signed gap vs the linear pace. Negative = behind. */
  paceDelta: number;
};

/**
 * Progress against a target, judged against elapsed time rather than the
 * raw percentage.
 *
 * 60% of a monthly goal is great on the 10th and a problem on the 28th.
 * Reporting a bare percentage would make the dashboard cheerful right up
 * until the month ends badly, so status is always pace-relative.
 *
 * Tolerance is ±10% of the expected pace: tighter than that and a single
 * quiet Tuesday flips the whole board to "behind", which trains her to
 * ignore it.
 */
export function goalProgress(
  actual: number,
  target: number,
  elapsedFraction: number,
): GoalProgress {
  if (!Number.isFinite(target) || target <= 0) {
    return {
      actual,
      target: 0,
      ratio: 0,
      expectedByNow: 0,
      status: "no_target",
      paceDelta: 0,
    };
  }

  const clampedElapsed = Math.min(1, Math.max(0, elapsedFraction));
  const expectedByNow = target * clampedElapsed;
  const paceDelta = actual - expectedByNow;

  let status: GoalStatus;
  if (actual >= target) {
    status = "ahead";
  } else if (expectedByNow === 0) {
    // Day one of the period: nothing is "behind" yet.
    status = "on_track";
  } else if (actual >= expectedByNow * 1.1) {
    status = "ahead";
  } else if (actual >= expectedByNow * 0.9) {
    status = "on_track";
  } else {
    status = "behind";
  }

  return {
    actual,
    target,
    ratio: actual / target,
    expectedByNow,
    status,
    paceDelta,
  };
}

/** Fraction of the month elapsed, counting today as a whole day. */
export function monthElapsedFraction(dayOfMonth: number, daysInMonth: number): number {
  if (daysInMonth <= 0) return 0;
  return Math.min(1, Math.max(0, dayOfMonth / daysInMonth));
}

// -------------------------------------------------------------------
// Revenue forecasting
// -------------------------------------------------------------------

export type RevenueForecast = {
  /** Money actually collected so far this month. */
  earnedToDate: number;
  /** Lessons already delivered but not yet paid for. */
  outstanding: number;
  /** Value of lessons already in the calendar for the rest of the month. */
  booked: number;
  /** earnedToDate + outstanding + booked — what the month ends at if
   *  nothing more is booked and everyone eventually pays. */
  bookedForecast: number;
  /** Naive linear extrapolation of the current run rate. */
  paceForecast: number;
};

/**
 * Two forecasts, deliberately.
 *
 * The booked forecast is the honest floor: it counts only lessons that
 * exist in the calendar. The pace forecast is the optimistic read: it
 * assumes the rest of the month looks like the start of it. Showing one
 * number would be a lie in one direction or the other, and she is the
 * one who knows which half of the month is typically busier.
 */
export function forecastMonth(input: {
  earnedToDate: number;
  outstanding: number;
  booked: number;
  dayOfMonth: number;
  daysInMonth: number;
}): RevenueForecast {
  const { earnedToDate, outstanding, booked, dayOfMonth, daysInMonth } = input;
  const delivered = earnedToDate + outstanding;
  const paceForecast =
    dayOfMonth > 0 ? (delivered / dayOfMonth) * daysInMonth : delivered;

  return {
    earnedToDate,
    outstanding,
    booked,
    bookedForecast: delivered + booked,
    paceForecast,
  };
}

// -------------------------------------------------------------------
// Marketing — content gap detection
// -------------------------------------------------------------------

export type SocialPostLite = {
  platform: "instagram" | "facebook" | "website";
  mediaType: string | null;
  postedAt: string | null;
  likes: number;
  comments: number;
  reach: number;
};

export type ContentGap = {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
};

const VIDEO_TYPES = new Set(["video", "reel", "reels", "clips"]);

/**
 * Rule-based gap detection, run BEFORE the model is asked for anything.
 *
 * These are the observations that are simply true given the numbers, and
 * they should not cost an API call or be at the mercy of a model's mood.
 * The AI advisor gets these as input and is asked to build on them, not
 * to rediscover them.
 */
export function detectContentGaps(
  posts: SocialPostLite[],
  now: Date,
  timeZone: string,
): ContentGap[] {
  const gaps: ContentGap[] = [];
  const withDates = posts.filter((p) => p.postedAt);

  // Nothing to say when there is no data — an empty state is better than
  // an invented insight.
  if (withDates.length === 0) return gaps;

  const daysAgo = (iso: string) => daysBetween(iso, now, timeZone);

  const lastPost = withDates.reduce((newest, p) =>
    new Date(p.postedAt!) > new Date(newest.postedAt!) ? p : newest,
  );
  const sinceLastPost = daysAgo(lastPost.postedAt!);

  if (sinceLastPost >= 7) {
    gaps.push({
      id: "silence",
      severity: sinceLastPost >= 14 ? "high" : "medium",
      title: `${sinceLastPost} d. be įrašo`,
      detail:
        "Pasiekiamumas krenta greičiausiai per pirmas dvi tylos savaites. Užtektų vienos nuotraukos iš treniruotės.",
    });
  }

  const lastWeek = withDates.filter((p) => daysAgo(p.postedAt!) <= 7);
  const videosLastWeek = lastWeek.filter((p) =>
    VIDEO_TYPES.has((p.mediaType ?? "").toLowerCase()),
  ).length;

  if (lastWeek.length > 0 && videosLastWeek === 0) {
    gaps.push({
      id: "no-video",
      severity: "medium",
      title: "Šią savaitę – nė vieno video",
      detail:
        "Video ir reel'ai paprastai pasiekia kelis kartus daugiau žmonių nei nuotraukos. Trumpas klipas iš jojimo užtrunka minutę.",
    });
  }

  // Engagement drift: compare the last 30 days against the 30 before it.
  const recent = withDates.filter((p) => daysAgo(p.postedAt!) <= 30);
  const previous = withDates.filter((p) => {
    const d = daysAgo(p.postedAt!);
    return d > 30 && d <= 60;
  });

  if (recent.length >= 3 && previous.length >= 3) {
    const avg = (xs: SocialPostLite[]) =>
      xs.reduce((s, p) => s + p.likes + p.comments, 0) / xs.length;
    const recentAvg = avg(recent);
    const prevAvg = avg(previous);
    if (prevAvg > 0 && recentAvg < prevAvg * 0.7) {
      gaps.push({
        id: "engagement-drop",
        severity: "high",
        title: "Įsitraukimas krito",
        detail: `Vidutiniškai ${Math.round(recentAvg)} reakcijos vs ${Math.round(prevAvg)} prieš mėnesį. Verta grįžti prie to, kas veikė.`,
      });
    }
  }

  return gaps;
}

/** Best-performing posts by total engagement, highest first. */
export function topPosts<T extends SocialPostLite>(posts: T[], limit = 3): T[] {
  return [...posts]
    .sort((a, b) => b.likes + b.comments - (a.likes + a.comments))
    .slice(0, limit);
}

// -------------------------------------------------------------------
// Formatting
// -------------------------------------------------------------------

/** Euro amounts, Lithuanian convention (1 234,50 €). */
export function formatEur(amount: number, opts: { cents?: boolean } = {}): string {
  return new Intl.NumberFormat("lt-LT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: opts.cents ? 2 : 0,
    maximumFractionDigits: opts.cents ? 2 : 0,
  }).format(amount);
}
