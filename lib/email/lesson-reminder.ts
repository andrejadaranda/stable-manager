// lib/email/lesson-reminder.ts
//
// Branded 24-hour lesson reminder email. Sent by the cron at
// /api/cron/reminders to every client whose lesson starts in the
// next 24-25h window AND who has reminder_pref='email' or 'both'.
//
// Brand voice: warm, restrained — same register as the client
// invitation email. No exclamation marks, no marketing. The CTA
// links the client into the app so any rescheduling happens
// in-product (where the owner/trainer can approve/decline) instead
// of as a free-form email reply nobody monitors.

import { sendEmail, emailFooter } from "@/lib/email/send";

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.longrein.eu";

type SendLessonReminderArgs = {
  /** Client email — the To address. */
  to:           string;
  /** First name for greeting. Falls back to "rider" if empty. */
  firstName:    string;
  /** Horse name — appears in subject + body. */
  horseName:    string | null;
  /** Trainer display name. Optional — surfaced as "with <trainer>" when present. */
  trainerName:  string | null;
  /** Lesson start time formatted in Europe/Vilnius wall-clock — caller decides format. */
  timeLabel:    string;
  /** Lesson date label (e.g. "Sunday 25 May"). */
  dateLabel:    string;
  /** Stable name (e.g. "Trakų Jojimo Klubas"). Surfaces under the CTA. */
  stableName:   string;
};

export async function sendLessonReminderEmail(args: SendLessonReminderArgs): Promise<void> {
  const greetingName = args.firstName.trim() || "rider";
  const horseLine =
    args.horseName && args.trainerName
      ? `${args.horseName} with ${args.trainerName}`
      : args.horseName
      ? args.horseName
      : args.trainerName
      ? `your trainer ${args.trainerName}`
      : "your lesson";

  const subject = `Reminder — ${args.horseName ?? "lesson"} tomorrow at ${args.timeLabel}`;
  const lessonsUrl = `${APP_URL}/dashboard/my-lessons`;

  // Plain-text fallback. Inbox placement is much better when both bodies
  // are present, and the CTA URL must be visible in plain-text clients too.
  const text = `Hi ${greetingName},

Quick reminder — ${horseLine} is scheduled for ${args.dateLabel} at ${args.timeLabel}.

Need to reschedule or have a question? Open your lessons in the app and message your trainer — they'll confirm the change with you:
${lessonsUrl}

See you at ${args.stableName}.

— Longrein
longrein.eu`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#F4ECDF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1B1B1B;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4ECDF;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(30,42,71,.04),0 8px 32px rgba(30,42,71,.06);">
        <!-- Brand wordmark -->
        <tr><td style="padding:28px 32px 4px;">
          <p style="margin:0;font-family:Georgia,serif;font-size:22px;color:#1E3A2A;letter-spacing:-.01em;">
            Longrein<span style="color:#B5793E;">.</span>
          </p>
        </td></tr>

        <!-- Headline -->
        <tr><td style="padding:20px 32px 12px;">
          <h1 style="margin:0 0 6px;font-family:Georgia,serif;font-size:24px;font-weight:600;line-height:1.25;color:#1E3A2A;letter-spacing:-.01em;">
            See you tomorrow, ${escapeHtml(greetingName)}.
          </h1>
          <p style="margin:0;font-size:13.5px;line-height:1.55;color:#6E6760;letter-spacing:.02em;text-transform:uppercase;font-weight:600;">
            Lesson reminder
          </p>
        </td></tr>

        <!-- Lesson card -->
        <tr><td style="padding:8px 32px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FBF7EF;border:1px solid #ECDFC9;border-radius:12px;">
            <tr><td style="padding:18px 20px;">
              <p style="margin:0 0 4px;font-size:11.5px;color:#8E867B;text-transform:uppercase;letter-spacing:.12em;font-weight:600;">
                ${escapeHtml(args.dateLabel)}
              </p>
              <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:28px;color:#1E3A2A;line-height:1.1;letter-spacing:-.01em;font-weight:600;">
                ${escapeHtml(args.timeLabel)}
              </p>
              <p style="margin:0;font-size:14.5px;color:#3F4A42;line-height:1.5;">
                ${escapeHtml(horseLine)}
              </p>
              <p style="margin:6px 0 0;font-size:12.5px;color:#6E6760;">
                at ${escapeHtml(args.stableName)}
              </p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Reschedule callout -->
        <tr><td style="padding:0 32px 8px;">
          <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#3F4A42;">
            Need to reschedule or have a question? Open your lessons in the app and
            message your trainer — they'll confirm the change with you.
          </p>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:0 32px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="border-radius:8px;background:#1E3A2A;">
              <a href="${lessonsUrl}" style="display:inline-block;padding:13px 22px;font-size:14.5px;font-weight:600;color:#F4ECDF;text-decoration:none;border-radius:8px;letter-spacing:.01em;">
                Open my lessons →
              </a>
            </td></tr>
          </table>
          <p style="margin:14px 0 0;font-size:12px;color:#6E6760;line-height:1.5;">
            Replies to this email aren't monitored. Use the app to talk to your
            trainer or message ${escapeHtml(args.stableName)} directly.
          </p>
        </td></tr>

        <tr><td style="padding:0 32px 28px;">
          ${emailFooter()}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendEmail({
    to:      args.to,
    subject,
    html,
    text,
    // Idempotency: lesson-reminder per (lesson, channel). The cron already
    // de-dups via reminder_dispatch_log, but the Resend-side key gives a
    // second layer in case of a duplicate fire within Resend's window.
    idempotencyKey: `lesson-reminder:${args.timeLabel}:${args.dateLabel}:${args.to}`,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
