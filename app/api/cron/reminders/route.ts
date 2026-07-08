// =============================================================
// GET /api/cron/reminders
//
// Hourly cron that fires lesson reminders to clients who opted in
// at signup time (clients.reminder_pref in 'email'|'sms'|'both').
//
// Idempotency: every dispatch attempt writes a row in
// reminder_dispatch_log keyed on (lesson_id, channel, offset_hours).
// The UNIQUE constraint + ON CONFLICT DO NOTHING guarantees no double-
// send even if the cron is retried, re-scheduled, or scaled > 1 worker.
//
// Window: looks 24h ahead — fires one reminder per (client, lesson)
// for any lesson whose starts_at falls inside the 24h–25h window
// from "now". Hourly cron + 1h window = exactly one fire per lesson.
//
// Schedule: configured via Vercel cron in vercel.json (or via the
// Dashboard) — runs at the top of every hour. Free tier permits
// daily; paid (Pro) permits hourly which is what we need.
//
// Auth: CRON_SECRET in env. Vercel cron sends the secret as
// `Authorization: Bearer <secret>` so random scanners can't trigger
// real Twilio billing.
// =============================================================

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendLessonReminderEmail } from "@/lib/email/lesson-reminder";
import { sendHealthDueReminderEmail } from "@/lib/email/health-due-reminder";
import { sendWeatherAlertEmail } from "@/lib/email/weather-alert";
import { sendTrialEndingEmail } from "@/lib/email/trial-ending";
import { sendOwnerWeeklyNudgeEmail } from "@/lib/email/owner-weekly-nudge";
import { sendSMS, toE164Lithuania } from "@/lib/sms/send";
import { sendPushToUser, pushConfigured, type PushPayload } from "@/lib/push/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Reminder window — fires this many hours before lesson.starts_at. */
const OFFSET_HOURS = 24;

type Channel = "email" | "sms";

type ReminderCandidate = {
  lesson_id:    string;
  stable_id:    string;
  stable_name:  string;
  client_id:    string;
  client_name:  string;
  client_email: string | null;
  client_phone: string | null;
  pref:         "email" | "sms" | "both";
  starts_at:    string;
  horse_name:   string | null;
  trainer_name: string | null;
};

export async function GET(req: Request) {
  // Cron secret check — protects against random GET scanners triggering
  // real Twilio billing. Vercel sends it as Bearer.
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  // The candidate window is "starts_at falls between +24h and +25h
  // from now". Hourly cron + 1h window = exactly one fire per lesson.
  const now    = new Date();
  const winFrom = new Date(now.getTime() + OFFSET_HOURS * 3600 * 1000);
  const winTo   = new Date(now.getTime() + (OFFSET_HOURS + 1) * 3600 * 1000);

  // Pull every candidate in one query. We hand-write the join via
  // PostgREST embed because the row count will stay tiny per hour
  // (most stables won't have 24h-ahead lessons every single hour).
  const { data: lessonRows, error } = await supabase
    .from("lessons")
    .select(`
      id, stable_id, starts_at, status,
      client:clients!inner(id, full_name, email, phone, reminder_pref),
      horse:horses(name),
      trainer:profiles(full_name),
      stable:stables(name)
    `)
    .gte("starts_at", winFrom.toISOString())
    .lt("starts_at", winTo.toISOString())
    .eq("status", "scheduled")
    .neq("client.reminder_pref", "none");

  if (error) {
    console.error("[cron/reminders] lesson fetch failed:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const candidates: ReminderCandidate[] = (lessonRows ?? []).map((l: any) => ({
    lesson_id:    l.id,
    stable_id:    l.stable_id,
    stable_name:  (Array.isArray(l.stable) ? l.stable[0]?.name : l.stable?.name) ?? "your stable",
    client_id:    l.client.id,
    client_name:  l.client.full_name,
    client_email: l.client.email,
    client_phone: l.client.phone,
    pref:         l.client.reminder_pref as "email" | "sms" | "both",
    starts_at:    l.starts_at,
    horse_name:   l.horse?.name ?? null,
    trainer_name: l.trainer?.full_name ?? null,
  }));

  // Expand "both" into two separate (lesson, channel) dispatches so
  // each channel's success/failure is tracked independently.
  type Dispatch = ReminderCandidate & { channel: Channel };
  const dispatches: Dispatch[] = [];
  for (const c of candidates) {
    if (c.pref === "email" || c.pref === "both") dispatches.push({ ...c, channel: "email" });
    if (c.pref === "sms"   || c.pref === "both") dispatches.push({ ...c, channel: "sms"   });
  }

  // Pre-check: which (lesson, channel, offset) pairs are ALREADY
  // logged. Skip those — idempotency layer #1. Layer #2 is the
  // UNIQUE constraint + ON CONFLICT DO NOTHING below.
  const lessonIds = Array.from(new Set(dispatches.map((d) => d.lesson_id)));
  const already = new Set<string>();
  if (lessonIds.length > 0) {
    const { data: existing } = await supabase
      .from("reminder_dispatch_log")
      .select("lesson_id, channel, offset_hours")
      .in("lesson_id", lessonIds)
      .eq("offset_hours", OFFSET_HOURS);
    for (const r of (existing ?? []) as Array<{ lesson_id: string; channel: Channel; offset_hours: number }>) {
      already.add(`${r.lesson_id}:${r.channel}:${r.offset_hours}`);
    }
  }

  const results = {
    candidates: candidates.length,
    sent:       0,
    skipped:    0,
    failed:     0,
  };

  for (const d of dispatches) {
    const key = `${d.lesson_id}:${d.channel}:${OFFSET_HOURS}`;
    if (already.has(key)) {
      results.skipped += 1;
      continue;
    }

    const body = renderMessage(d);
    let status: "sent" | "delivered" | "failed" | "skipped" = "queued" as any;
    let providerId: string | null  = null;
    let errorMessage: string | null = null;

    try {
      if (d.channel === "email") {
        if (!d.client_email) {
          status = "skipped";
          errorMessage = "client has no email";
        } else {
          await sendLessonReminderEmail({
            to:          d.client_email,
            firstName:   d.client_name.split(" ")[0] ?? d.client_name,
            horseName:   d.horse_name,
            trainerName: d.trainer_name,
            timeLabel:   formatTime(d.starts_at),
            dateLabel:   formatDate(d.starts_at),
            stableName:  d.stable_name,
          });
          status = "sent";
        }
      } else {
        const phone = toE164Lithuania(d.client_phone);
        if (!phone) {
          status = "skipped";
          errorMessage = "client phone missing or non-Lithuanian — caller must normalise";
        } else {
          const res = await sendSMS({ to: phone, body });
          providerId = res.sid;
          status = "sent";
        }
      }
    } catch (err: any) {
      status = "failed";
      errorMessage = err?.message ?? "unknown send error";
    }

    // Append to log — ON CONFLICT DO NOTHING is the second
    // idempotency layer. If a parallel cron beat us to the insert,
    // we silently move on.
    const { error: logErr } = await supabase
      .from("reminder_dispatch_log")
      .insert({
        stable_id:     d.stable_id,
        lesson_id:     d.lesson_id,
        client_id:     d.client_id,
        channel:       d.channel,
        offset_hours:  OFFSET_HOURS,
        status,
        provider_id:   providerId,
        error_message: errorMessage,
        message_body:  body.slice(0, 2048),
      });
    if (logErr && !/duplicate key/.test(logErr.message)) {
      console.error("[cron/reminders] log insert failed:", logErr);
    }

    // Provider-side "delivered" status would arrive via webhook, not from
    // this synchronous send call — so we only ever set "sent" here. The
    // success bucket also catches any future "delivered" rows by name.
    if (status === "sent")        results.sent += 1;
    else if (status === "skipped") results.skipped += 1;
    else                           results.failed += 1;
  }

  // ---- Health-record due-date reminders -----------------------
  // Sprint 4 "Equilab killer" #5: scan horse_health_records.next_due_on
  // for windows landing exactly 7, 3, or 1 day(s) from today. One email
  // per (record, days_before) thanks to health_reminder_dispatch_log
  // uniqueness. Runs in same cron to stay inside Vercel's free quota.
  const healthResults = await runHealthDueReminders(supabase);

  // ---- Weather alerts (freeze / heat) -------------------------
  // Sprint 4 "Equilab killer" #7. Per-stable opt-in via stables.weather_*
  // columns. One OpenWeather One Call API request per stable per day.
  // Free tier permits 1000 calls/day — plenty.
  const weatherResults = await runWeatherAlerts(supabase);

  // ---- Trial-ending drip (Founding-15 conversion) -------------
  // Email the owner when their trial has 7 / 3 / 1 days left.
  // Idempotent via trial_drip_dispatch_log (stable_id, milestone).
  const trialResults = await runTrialDrip(supabase);

  // ---- 15-minutes-before lesson PUSH (client + stable staff) ---------
  // Needs a frequent scheduler (~every 10 min) to actually fire; on a
  // daily cron it's a no-op. Dormant until VAPID keys are set.
  const pushResults = await runLessonPushReminders(supabase);

  // ---- Monday owner "money + welfare" nudge -------------------
  // One email per stable per ISO week (Mondays only): outstanding
  // boarding + horses over the weekly cap. Only sent when non-empty.
  const ownerNudgeResults = await runOwnerWeeklyNudge(supabase);

  // ---- Morning "today's lessons" push digest ------------------
  // Once per day (~07:00 Europe/Vilnius): one push per person with lessons
  // today — staff get the stable-wide count, clients get their own. Native
  // APNs + web push. Idempotent via push_morning_digest_log (user, day).
  // Dormant until push is configured.
  const morningDigestResults = await runMorningLessonDigest(supabase);

  return NextResponse.json({
    ok: true,
    ...results,
    health: healthResults,
    weather: weatherResults,
    trial: trialResults,
    push: pushResults,
    ownerNudge: ownerNudgeResults,
    morningDigest: morningDigestResults,
    window: { from: winFrom.toISOString(), to: winTo.toISOString() },
  });
}

// ----------------------------------------------------------------
// Morning lesson digest — one push per person with lessons remaining
// today. Fires only in the 07:00 Europe/Vilnius hour (the hourly cron +
// hour gate = exactly one fire per day). Idempotent per (user, day).
// ----------------------------------------------------------------
type MorningDigestResult = { fired: string; candidates: number; sent: number; skipped: number };

/** ms to add to a UTC instant to get the wall-clock time in `tz`. */
function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value;
  const asUTC = Date.UTC(
    +map.year, +map.month - 1, +map.day,
    +map.hour % 24, +map.minute, +map.second,
  );
  return asUTC - date.getTime();
}

async function runMorningLessonDigest(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
): Promise<MorningDigestResult> {
  const tally: MorningDigestResult = { fired: "no", candidates: 0, sent: 0, skipped: 0 };
  if (!pushConfigured()) { tally.fired = "push-not-configured"; return tally; }

  const now = new Date();
  const off = tzOffsetMs(now, "Europe/Vilnius");
  const wall = new Date(now.getTime() + off);        // Vilnius wall clock as a UTC-shaped Date
  if (wall.getUTCHours() !== 7) { tally.fired = `not-morning(${wall.getUTCHours()}h)`; return tally; }
  tally.fired = "yes";

  const pad = (n: number) => String(n).padStart(2, "0");
  const dayKey = `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}`;
  const endUtc = new Date(
    Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate(), 23, 59, 59, 999) - off,
  );

  // Today's still-upcoming scheduled lessons (from now to end of Vilnius day).
  const { data: rows } = await supabase
    .from("lessons")
    .select(`id, stable_id, starts_at, client:clients(id, full_name, profile_id), horse:horses(name)`)
    .gte("starts_at", now.toISOString())
    .lt("starts_at", endUtc.toISOString())
    .eq("status", "scheduled")
    .order("starts_at", { ascending: true });
  const lessons = (rows ?? []) as Array<any>;
  if (lessons.length === 0) return tally;

  const stableIds = Array.from(new Set(lessons.map((l) => l.stable_id)));
  const byStable = new Map<string, any[]>();
  for (const l of lessons) {
    const arr = byStable.get(l.stable_id) ?? [];
    arr.push(l);
    byStable.set(l.stable_id, arr);
  }

  type Msg = { uid: string; payload: PushPayload };
  const messages: Msg[] = [];

  // Staff — stable-wide count.
  const { data: staff } = await supabase
    .from("profiles")
    .select("auth_user_id, stable_id")
    .in("stable_id", stableIds)
    .in("role", ["owner", "employee"]);
  for (const s of (staff ?? []) as Array<{ auth_user_id: string | null; stable_id: string }>) {
    if (!s.auth_user_id) continue;
    const ls = byStable.get(s.stable_id) ?? [];
    if (ls.length === 0) continue;
    const first = formatTime(ls[0].starts_at);
    messages.push({
      uid: s.auth_user_id,
      payload: {
        title: "Today at the stable",
        body: `${ls.length} lesson${ls.length === 1 ? "" : "s"} today — first at ${first}`,
        url: "/dashboard/calendar",
      },
    });
  }

  // Clients — their own lessons.
  const clientLessons = new Map<string, any[]>(); // profile_id -> lessons
  for (const l of lessons) {
    const pid = l.client?.profile_id;
    if (!pid) continue;
    const arr = clientLessons.get(pid) ?? [];
    arr.push(l);
    clientLessons.set(pid, arr);
  }
  if (clientLessons.size > 0) {
    const { data: cprofs } = await supabase
      .from("profiles")
      .select("id, auth_user_id")
      .in("id", Array.from(clientLessons.keys()));
    const uidByProfile = new Map(
      ((cprofs ?? []) as Array<{ id: string; auth_user_id: string | null }>).map((p) => [p.id, p.auth_user_id]),
    );
    for (const [pid, ls] of clientLessons) {
      const uid = uidByProfile.get(pid);
      if (!uid) continue;
      const first = formatTime(ls[0].starts_at);
      const horse = ls[0].horse?.name ? ` (${ls[0].horse.name})` : "";
      messages.push({
        uid,
        payload: {
          title: "Your lesson today",
          body: ls.length === 1 ? `Lesson at ${first}${horse}` : `${ls.length} lessons today — first at ${first}`,
          url: "/dashboard/calendar",
        },
      });
    }
  }

  // One push per user per day — staff message wins if someone is both.
  const seen = new Set<string>();
  for (const m of messages) {
    if (seen.has(m.uid)) continue;
    seen.add(m.uid);
    tally.candidates += 1;
    const { error } = await supabase
      .from("push_morning_digest_log")
      .insert({ auth_user_id: m.uid, day_key: dayKey });
    if (error) {
      if (!/duplicate key/i.test(error.message)) console.error("[cron/morning-digest] log insert failed:", error);
      tally.skipped += 1;
      continue;
    }
    const n = await sendPushToUser(m.uid, m.payload);
    if (n > 0) tally.sent += 1;
    else tally.skipped += 1;
  }

  return tally;
}

// ----------------------------------------------------------------
// Monday owner nudge — outstanding boarding + over-cap horses.
// Runs only on Mondays (UTC). Idempotent via owner_weekly_nudge_log
// (stable_id, week_key). Sent to owner + employees with an email, and
// only when there's actually something to act on.
// ----------------------------------------------------------------
type OwnerNudgeResult = { day: string; candidates: number; sent: number; skipped: number; failed: number };

async function runOwnerWeeklyNudge(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
): Promise<OwnerNudgeResult> {
  const tally: OwnerNudgeResult = { day: "", candidates: 0, sent: 0, skipped: 0, failed: 0 };
  const now = new Date();
  // Mondays only (UTC getDay(): 0=Sun, 1=Mon).
  if (now.getUTCDay() !== 1) { tally.day = "not-monday"; return tally; }
  tally.day = "monday";
  const weekKey = isoWeekKey(now);

  // 1) Outstanding boarding per stable (remaining = amount − paid).
  const boardingByStable = new Map<string, { total: number; count: number }>();
  const { data: charges } = await supabase
    .from("horse_boarding_summary")
    .select("stable_id, amount, paid_amount, payment_status")
    .neq("payment_status", "paid");
  for (const c of (charges ?? []) as Array<{ stable_id: string; amount: number; paid_amount: number }>) {
    const remaining = Math.max(0, Number(c.amount) - Number(c.paid_amount));
    if (remaining <= 0) continue;
    const cur = boardingByStable.get(c.stable_id) ?? { total: 0, count: 0 };
    cur.total += remaining; cur.count += 1;
    boardingByStable.set(c.stable_id, cur);
  }

  // 2) Over-cap horses over the PREVIOUS completed week (Mon–Sun). We run
  //    Monday morning, so "this week" has barely any lessons yet — the
  //    meaningful signal is which horses were worked to/over their cap in
  //    the week that just finished.
  const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekEnd = thisMonday;                                   // exclusive upper bound
  const weekStart = new Date(thisMonday.getTime() - 7 * 86_400_000); // last Monday
  const [{ data: horses }, { data: weekLessons }] = await Promise.all([
    supabase.from("horses").select("id, name, stable_id, weekly_lesson_limit").eq("active", true).gt("weekly_lesson_limit", 0),
    supabase.from("lessons").select("horse_id").gte("starts_at", weekStart.toISOString()).lt("starts_at", weekEnd.toISOString()).neq("status", "cancelled"),
  ]);
  const countByHorse = new Map<string, number>();
  for (const l of (weekLessons ?? []) as Array<{ horse_id: string }>) {
    countByHorse.set(l.horse_id, (countByHorse.get(l.horse_id) ?? 0) + 1);
  }
  const overCapByStable = new Map<string, string[]>();
  for (const h of (horses ?? []) as Array<{ id: string; name: string; stable_id: string; weekly_lesson_limit: number }>) {
    if ((countByHorse.get(h.id) ?? 0) >= h.weekly_lesson_limit) {
      const arr = overCapByStable.get(h.stable_id) ?? [];
      arr.push(h.name);
      overCapByStable.set(h.stable_id, arr);
    }
  }

  const stableIds = Array.from(new Set<string>([...boardingByStable.keys(), ...overCapByStable.keys()]));
  if (stableIds.length === 0) return tally;

  const [{ data: stables }, { data: staff }] = await Promise.all([
    supabase.from("stables").select("id, name").in("id", stableIds),
    supabase.from("profiles").select("stable_id, full_name, email, role").in("stable_id", stableIds).in("role", ["owner", "employee"]),
  ]);
  const nameById = new Map(((stables ?? []) as Array<{ id: string; name: string }>).map((s) => [s.id, s.name]));
  const staffByStable = new Map<string, Array<{ full_name: string | null; email: string | null }>>();
  for (const s of (staff ?? []) as Array<{ stable_id: string; full_name: string | null; email: string | null }>) {
    if (!s.email) continue;
    const arr = staffByStable.get(s.stable_id) ?? [];
    arr.push({ full_name: s.full_name, email: s.email });
    staffByStable.set(s.stable_id, arr);
  }

  for (const sid of stableIds) {
    tally.candidates += 1;
    // Claim the (stable, week) row first — idempotency.
    const { error: logErr } = await supabase.from("owner_weekly_nudge_log").insert({ stable_id: sid, week_key: weekKey });
    if (logErr) {
      if (!/duplicate key/i.test(logErr.message)) console.error("[cron/owner-nudge] log insert failed:", logErr);
      tally.skipped += 1;
      continue;
    }
    const recipients = staffByStable.get(sid) ?? [];
    if (recipients.length === 0) { tally.skipped += 1; continue; }
    const money = boardingByStable.get(sid) ?? { total: 0, count: 0 };
    const overCap = overCapByStable.get(sid) ?? [];
    let anySent = false;
    for (const r of recipients) {
      try {
        await sendOwnerWeeklyNudgeEmail({
          to:                  r.email!,
          firstName:           (r.full_name ?? "").split(" ")[0] ?? "",
          stableName:          nameById.get(sid) ?? "your stable",
          unpaidBoardingTotal: money.total,
          unpaidBoardingCount: money.count,
          overCapHorses:       overCap,
        });
        anySent = true;
      } catch (err: any) {
        console.error("[cron/owner-nudge] send failed:", err?.message ?? err);
      }
    }
    if (anySent) tally.sent += 1; else tally.failed += 1;
  }

  return tally;
}

/** ISO-8601 week key, e.g. "2026-W27". */
function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;          // Mon=1..Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - day); // nearest Thursday
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ----------------------------------------------------------------
// 15-minutes-before lesson push reminders. Window = lessons starting
// in the next 15–25 min (a 10-min catch window for an every-10-min
// scheduler). Recipients: the booked client (if they have a portal
// account + subscription) AND the stable's owner/employees. Idempotent
// via reminder_dispatch_log (channel='push', offset_hours=0.25).
// ----------------------------------------------------------------
type PushResult = { candidates: number; sent: number; skipped: number };

async function runLessonPushReminders(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
): Promise<PushResult> {
  const tally: PushResult = { candidates: 0, sent: 0, skipped: 0 };
  if (!pushConfigured()) return tally; // VAPID not set → dormant

  const now = new Date();
  const winFrom = new Date(now.getTime() + 15 * 60 * 1000);
  const winTo = new Date(now.getTime() + 25 * 60 * 1000);

  const { data: lessonRows } = await supabase
    .from("lessons")
    .select(`id, stable_id, starts_at, client:clients(id, full_name, profile_id), horse:horses(name)`)
    .gte("starts_at", winFrom.toISOString())
    .lt("starts_at", winTo.toISOString())
    .eq("status", "scheduled");
  const rows = (lessonRows ?? []) as Array<any>;
  tally.candidates = rows.length;
  if (rows.length === 0) return tally;

  const ids = rows.map((r) => r.id);
  const { data: logged } = await supabase
    .from("reminder_dispatch_log")
    .select("lesson_id")
    .eq("channel", "push")
    .eq("offset_hours", 0.25)
    .in("lesson_id", ids);
  const already = new Set(((logged ?? []) as Array<{ lesson_id: string }>).map((r) => r.lesson_id));

  for (const l of rows) {
    if (already.has(l.id)) { tally.skipped += 1; continue; }
    const time = formatTime(l.starts_at);
    const horse = l.horse?.name ? ` (${l.horse.name})` : "";
    const who = l.client?.full_name ?? "Lesson";

    const recipients = new Set<string>();
    if (l.client?.profile_id) {
      const { data: cp } = await supabase
        .from("profiles").select("auth_user_id").eq("id", l.client.profile_id).maybeSingle();
      const uid = (cp as { auth_user_id?: string } | null)?.auth_user_id;
      if (uid) recipients.add(uid);
    }
    const { data: staff } = await supabase
      .from("profiles").select("auth_user_id").eq("stable_id", l.stable_id).in("role", ["owner", "employee"]);
    for (const s of (staff ?? []) as Array<{ auth_user_id: string | null }>) {
      if (s.auth_user_id) recipients.add(s.auth_user_id);
    }

    let anySent = false;
    for (const uid of recipients) {
      const n = await sendPushToUser(uid, {
        title: "Lesson in 15 minutes",
        body: `${who}${horse} at ${time}`,
        url: "/dashboard/calendar",
      });
      if (n > 0) anySent = true;
    }

    await supabase.from("reminder_dispatch_log").insert({
      stable_id: l.stable_id,
      lesson_id: l.id,
      client_id: l.client?.id ?? null,
      channel: "push",
      offset_hours: 0.25,
      status: anySent ? "sent" : "skipped",
      message_body: `Lesson in 15 min — ${who}${horse} at ${time}`.slice(0, 2048),
    });
    if (anySent) tally.sent += 1;
    else tally.skipped += 1;
  }

  return tally;
}

// ----------------------------------------------------------------
// Trial-ending drip — one email per stable at 7, 3, and 1 days left.
// Daily cron + per-milestone idempotency = exactly one send per bucket.
// ----------------------------------------------------------------
type TrialDripResult = {
  candidates: number;
  sent:       number;
  skipped:    number;
  failed:     number;
};

async function runTrialDrip(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
): Promise<TrialDripResult> {
  const tally: TrialDripResult = { candidates: 0, sent: 0, skipped: 0, failed: 0 };
  const MILESTONES = [7, 3, 1];

  // Trialing stables whose trial ends within the next 7 days.
  const now = new Date();
  const horizon = new Date(now.getTime() + 8 * 24 * 3600 * 1000);
  const { data: stables, error } = await supabase
    .from("stables")
    .select("id, name, trial_ends_at")
    .not("trial_ends_at", "is", null)
    .gte("trial_ends_at", now.toISOString())
    .lte("trial_ends_at", horizon.toISOString());
  if (error) {
    console.error("[cron/trial] stable fetch failed:", error);
    return tally;
  }

  for (const s of (stables ?? []) as Array<{ id: string; name: string; trial_ends_at: string }>) {
    // Whole days remaining (ceil so "1.4 days" still counts as the 1-day mark).
    const msLeft = new Date(s.trial_ends_at).getTime() - now.getTime();
    const daysLeft = Math.ceil(msLeft / (24 * 3600 * 1000));
    const milestone = MILESTONES.find((m) => daysLeft === m);
    if (!milestone) continue;
    tally.candidates += 1;

    // Idempotency: claim the (stable, milestone) row first.
    const { error: logErr } = await supabase
      .from("trial_drip_dispatch_log")
      .insert({ stable_id: s.id, milestone });
    if (logErr) {
      // Duplicate = already sent this milestone → skip silently.
      if (!/duplicate key/i.test(logErr.message)) {
        console.error("[cron/trial] log insert failed:", logErr);
      }
      tally.skipped += 1;
      continue;
    }

    // Resolve the owner's email + first name via profiles → auth.users.
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, auth_user_id")
      .eq("stable_id", s.id)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();
    const authUserId = (prof as { auth_user_id?: string } | null)?.auth_user_id;
    if (!authUserId) { tally.failed += 1; continue; }

    const { data: authUser } = await supabase.auth.admin.getUserById(authUserId);
    const email = authUser?.user?.email ?? null;
    if (!email) { tally.failed += 1; continue; }
    const firstName = ((prof as { full_name?: string } | null)?.full_name ?? "").split(" ")[0] ?? "";

    try {
      await sendTrialEndingEmail({
        to: email,
        firstName,
        stableName: s.name ?? "your stable",
        daysLeft: milestone,
      });
      tally.sent += 1;
    } catch (err) {
      console.error("[cron/trial] email send failed:", err);
      tally.failed += 1;
    }
  }

  return tally;
}

// ----------------------------------------------------------------
// Health due-date reminders — owners + employees only (clients don't
// book the farrier). Idempotent via health_reminder_dispatch_log.
// ----------------------------------------------------------------
type HealthDispatchResult = {
  candidates: number;
  sent:       number;
  skipped:    number;
  failed:     number;
};

async function runHealthDueReminders(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
): Promise<HealthDispatchResult> {
  const tally: HealthDispatchResult = { candidates: 0, sent: 0, skipped: 0, failed: 0 };

  // Today, +3d, +7d — UTC date strings. We compare against a date column,
  // so the day boundary matches the user's local calendar within 1h offset
  // (acceptable for "7-day heads up" granularity).
  const today = new Date();
  const ymd = (offsetDays: number): string => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  };
  const targetDates: Array<{ date: string; daysBefore: 1 | 3 | 7 }> = [
    { date: ymd(1), daysBefore: 1 },
    { date: ymd(3), daysBefore: 3 },
    { date: ymd(7), daysBefore: 7 },
  ];

  for (const tgt of targetDates) {
    const { data: records, error } = await supabase
      .from("horse_health_records")
      .select(`
        id, stable_id, horse_id, kind, title, next_due_on,
        horse:horses(name),
        stable:stables(name)
      `)
      .eq("next_due_on", tgt.date)
      .in("kind", ["vaccination", "farrier", "vet"]);

    if (error) {
      console.error(`[cron/health] fetch failed (${tgt.date}):`, error);
      continue;
    }
    const rows = (records ?? []) as unknown as Array<{
      id:           string;
      stable_id:    string;
      horse_id:     string;
      kind:         "vaccination" | "farrier" | "vet";
      title:        string;
      next_due_on:  string;
      horse:  { name: string } | { name: string }[] | null;
      stable: { name: string } | { name: string }[] | null;
    }>;
    if (rows.length === 0) continue;
    tally.candidates += rows.length;

    // Pre-fetch already-dispatched (record, days_before, email) tuples.
    const recordIds = rows.map((r) => r.id);
    const { data: existingLog } = await supabase
      .from("health_reminder_dispatch_log")
      .select("record_id, days_before")
      .in("record_id", recordIds)
      .eq("days_before", tgt.daysBefore)
      .eq("channel", "email");
    const alreadyDispatched = new Set(
      ((existingLog ?? []) as Array<{ record_id: string; days_before: number }>)
        .map((r) => `${r.record_id}:${r.days_before}`),
    );

    // Audience = every owner + employee at the same stable.
    // Pull them in one batch per stable to amortize the round-trip.
    const stableIds = Array.from(new Set(rows.map((r) => r.stable_id)));
    const { data: staffRows } = await supabase
      .from("profiles")
      .select("id, stable_id, full_name, role, email")
      .in("stable_id", stableIds)
      .in("role", ["owner", "employee"]);
    const staffByStable = new Map<string, Array<{ full_name: string | null; email: string | null }>>();
    for (const s of (staffRows ?? []) as Array<{ stable_id: string; full_name: string | null; email: string | null; role: string }>) {
      if (!s.email) continue;
      if (!staffByStable.has(s.stable_id)) staffByStable.set(s.stable_id, []);
      staffByStable.get(s.stable_id)!.push({ full_name: s.full_name, email: s.email });
    }

    for (const rec of rows) {
      const key = `${rec.id}:${tgt.daysBefore}`;
      if (alreadyDispatched.has(key)) {
        tally.skipped += 1;
        continue;
      }

      const staff = staffByStable.get(rec.stable_id) ?? [];
      if (staff.length === 0) {
        tally.skipped += 1;
        // Still log so we don't keep retrying tomorrow.
        await supabase.from("health_reminder_dispatch_log").insert({
          stable_id:     rec.stable_id,
          record_id:     rec.id,
          horse_id:      rec.horse_id,
          channel:       "email",
          days_before:   tgt.daysBefore,
          status:        "skipped",
          error_message: "no staff with email at stable",
        });
        continue;
      }

      const dueLabel = new Intl.DateTimeFormat("en-GB", {
        weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Vilnius",
      }).format(new Date(rec.next_due_on + "T12:00:00Z"));

      let anySent = false;
      let firstError: string | null = null;
      for (const member of staff) {
        try {
          await sendHealthDueReminderEmail({
            to:           member.email!,
            firstName:    (member.full_name ?? "").split(" ")[0] ?? "team",
            horseName:    pickName(rec.horse) ?? "(unnamed horse)",
            kind:         rec.kind,
            title:        rec.title,
            dueDateLabel: dueLabel,
            daysBefore:   tgt.daysBefore,
            stableName:   pickName(rec.stable) ?? "your stable",
          });
          anySent = true;
        } catch (err: any) {
          if (!firstError) firstError = err?.message ?? "unknown send error";
        }
      }

      // One log row per (record, days_before, channel) — represents the
      // batch as a whole.  `provider_id` left null because we fan out to
      // multiple recipients; per-recipient detail lives in Resend.
      const { error: logErr } = await supabase
        .from("health_reminder_dispatch_log")
        .insert({
          stable_id:     rec.stable_id,
          record_id:     rec.id,
          horse_id:      rec.horse_id,
          channel:       "email",
          days_before:   tgt.daysBefore,
          status:        anySent ? "sent" : "failed",
          error_message: anySent ? null : firstError,
          message_body:  `${rec.title} — ${pickName(rec.horse) ?? "horse"} (${rec.kind}) due ${dueLabel}`.slice(0, 2048),
        });
      if (logErr && !/duplicate key/.test(logErr.message)) {
        console.error("[cron/health] log insert failed:", logErr);
      }

      if (anySent) tally.sent += 1;
      else         tally.failed += 1;
    }
  }

  return tally;
}

/** PostgREST returns embedded relations as either object or array — normalize. */
function pickName(rel: { name: string } | { name: string }[] | null): string | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0]?.name ?? null;
  return rel.name;
}

// ----------------------------------------------------------------
// Weather alerts — freeze + heat for the next 24h. One OpenWeather
// One Call request per opted-in stable. Idempotent via
// weather_alert_dispatch_log (stable_id, alert_date, kind).
// ----------------------------------------------------------------
type WeatherDispatchResult = {
  stables_checked: number;
  alerts_sent:     number;
  skipped:         number;
  failed:          number;
};

async function runWeatherAlerts(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
): Promise<WeatherDispatchResult> {
  const tally: WeatherDispatchResult = { stables_checked: 0, alerts_sent: 0, skipped: 0, failed: 0 };

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    // Treat unconfigured environment as silent no-op — we don't want
    // cron to fail before the env var is set in Vercel.
    return tally;
  }

  // Pull every opted-in stable in one go.
  const { data: stables, error } = await supabase
    .from("stables")
    .select(`
      id, name,
      weather_lat, weather_lng,
      weather_freeze_below_c, weather_heat_above_c,
      weather_alerts_enabled
    `)
    .eq("weather_alerts_enabled", true)
    .not("weather_lat", "is", null)
    .not("weather_lng", "is", null);
  if (error) {
    console.error("[cron/weather] stable fetch failed:", error);
    return tally;
  }
  const stableRows = (stables ?? []) as Array<{
    id: string;
    name: string;
    weather_lat: number;
    weather_lng: number;
    weather_freeze_below_c: number | null;
    weather_heat_above_c:   number | null;
  }>;
  if (stableRows.length === 0) return tally;
  tally.stables_checked = stableRows.length;

  // Alert date = tomorrow (Europe/Vilnius wall day; UTC date is close enough).
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const alertDate = tomorrow.toISOString().slice(0, 10);
  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Vilnius",
  }).format(tomorrow);

  for (const s of stableRows) {
    try {
      // OpenWeather One Call 3.0 — daily forecast. Imperial vs metric:
      // we ask for metric so the threshold compare stays trivial.
      const url =
        `https://api.openweathermap.org/data/3.0/onecall?lat=${s.weather_lat}&lon=${s.weather_lng}` +
        `&exclude=current,minutely,hourly,alerts&units=metric&appid=${apiKey}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        tally.failed += 1;
        continue;
      }
      const json = (await res.json()) as {
        daily?: Array<{ temp?: { min?: number; max?: number } }>;
      };
      const tomorrowFc = json.daily?.[1]; // 0 = today, 1 = tomorrow
      if (!tomorrowFc?.temp) {
        tally.skipped += 1;
        continue;
      }
      const low  = tomorrowFc.temp.min ?? null;
      const high = tomorrowFc.temp.max ?? null;

      const kindsToFire: Array<{ kind: "freeze" | "heat"; threshold: number; value: number }> = [];
      if (s.weather_freeze_below_c != null && low != null && low <= s.weather_freeze_below_c) {
        kindsToFire.push({ kind: "freeze", threshold: s.weather_freeze_below_c, value: low });
      }
      if (s.weather_heat_above_c != null && high != null && high >= s.weather_heat_above_c) {
        kindsToFire.push({ kind: "heat", threshold: s.weather_heat_above_c, value: high });
      }
      if (kindsToFire.length === 0) {
        tally.skipped += 1;
        continue;
      }

      // Dedupe by (stable, date, kind).
      const { data: existing } = await supabase
        .from("weather_alert_dispatch_log")
        .select("kind")
        .eq("stable_id", s.id)
        .eq("alert_date", alertDate);
      const already = new Set(((existing ?? []) as Array<{ kind: string }>).map((r) => r.kind));

      // Audience: every staff member of the stable with an email.
      const { data: staff } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("stable_id", s.id)
        .in("role", ["owner", "employee"]);
      const recipients = ((staff ?? []) as Array<{ full_name: string | null; email: string | null }>)
        .filter((r) => !!r.email);

      for (const fire of kindsToFire) {
        if (already.has(fire.kind)) {
          tally.skipped += 1;
          continue;
        }
        if (recipients.length === 0) {
          tally.skipped += 1;
          await supabase.from("weather_alert_dispatch_log").insert({
            stable_id:        s.id,
            alert_date:       alertDate,
            kind:             fire.kind,
            forecast_value_c: fire.value,
            status:           "skipped",
            error_message:    "no staff with email at stable",
          });
          continue;
        }

        let anySent = false;
        let firstError: string | null = null;
        for (const r of recipients) {
          try {
            await sendWeatherAlertEmail({
              to:           r.email!,
              firstName:    (r.full_name ?? "").split(" ")[0] ?? "team",
              stableName:   s.name,
              kind:         fire.kind,
              thresholdC:   fire.threshold,
              forecastC:    fire.value,
              forDateLabel: dateLabel,
            });
            anySent = true;
          } catch (err: any) {
            if (!firstError) firstError = err?.message ?? "unknown send error";
          }
        }

        await supabase.from("weather_alert_dispatch_log").insert({
          stable_id:        s.id,
          alert_date:       alertDate,
          kind:             fire.kind,
          forecast_value_c: fire.value,
          status:           anySent ? "sent" : "failed",
          error_message:    anySent ? null : firstError,
        });
        if (anySent) tally.alerts_sent += 1;
        else         tally.failed += 1;
      }
    } catch (err: any) {
      console.error(`[cron/weather] stable ${s.id} failed:`, err?.message ?? err);
      tally.failed += 1;
    }
  }

  return tally;
}

// ----------------------------------------------------------------
// Message rendering — kept inline because there's only one template
// shape per channel. When we add the 2h-before reminder + the post-
// lesson follow-up, extract to a templates/ dir.
// ----------------------------------------------------------------
// Short SMS body — phone-friendly, single line, no link (Lithuanian
// SMS gateways charge per segment, so we keep it brief). Email goes
// through the branded HTML template via sendLessonReminderEmail.
function renderMessage(d: ReminderCandidate): string {
  const time   = formatTime(d.starts_at);
  const horse  = d.horse_name  ? ` with ${d.horse_name}`  : "";
  const trainer = d.trainer_name ? ` (${d.trainer_name})` : "";
  return `Hi ${d.client_name.split(" ")[0]} — your lesson${horse}${trainer} is tomorrow at ${time}. Open Longrein to reschedule.`;
}

function formatTime(iso: string): string {
  // Render in Europe/Vilnius wall-clock — matches what the owner saw
  // when they booked, not UTC offset of the storage timestamp.
  return new Intl.DateTimeFormat("en-GB", {
    hour:     "2-digit",
    minute:   "2-digit",
    hour12:   false,
    timeZone: "Europe/Vilnius",
  }).format(new Date(iso));
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday:  "long",
    day:      "numeric",
    month:    "long",
    timeZone: "Europe/Vilnius",
  }).format(new Date(iso));
}
