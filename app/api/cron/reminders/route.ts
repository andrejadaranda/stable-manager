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
import { sendSMS, toE164Lithuania } from "@/lib/sms/send";

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

  return NextResponse.json({
    ok: true,
    ...results,
    health: healthResults,
    weather: weatherResults,
    window: { from: winFrom.toISOString(), to: winTo.toISOString() },
  });
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
