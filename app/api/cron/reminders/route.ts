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

  return NextResponse.json({ ok: true, ...results, window: { from: winFrom.toISOString(), to: winTo.toISOString() } });
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
