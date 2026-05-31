// lib/email/trial-ending.ts
//
// Trial-ending drip email. Sent by the daily cron at /api/cron/reminders
// to a stable owner when their free trial has 7, 3, or 1 day(s) left.
// Goal: convert the Founding-15 cohort before the trial lapses.
//
// Brand voice: calm, useful, no fake urgency. Restate the founding offer
// (50% locked for life) once, give a single CTA to billing.

import { sendEmail, emailFooter } from "@/lib/email/send";

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.longrein.eu";

type TrialEndingArgs = {
  to:         string;
  firstName:  string;
  stableName: string;
  daysLeft:   number;   // 7 | 3 | 1
};

export async function sendTrialEndingEmail(args: TrialEndingArgs): Promise<void> {
  const greeting = args.firstName.trim() || "there";
  const billingUrl = `${APP_URL}/dashboard/settings/billing`;

  const when =
    args.daysLeft <= 1 ? "tomorrow"
    : `in ${args.daysLeft} days`;

  const subject =
    args.daysLeft <= 1
      ? "Your Longrein trial ends tomorrow"
      : `Your Longrein trial ends ${when}`;

  const text = `Hi ${greeting},

Your Longrein free trial for ${args.stableName} ends ${when}.

You're one of our first founding stables, so your plan stays at 50% — locked
for life — when you continue. Nothing changes in how you work; the data,
calendar, horses, and payments you've set up all stay exactly as they are.

Keep your founding rate:
${billingUrl}

Questions before you decide? Just reply to this email.

— Longrein
longrein.eu`;

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#FAF8F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1E3A2A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAF8F4;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFFFF;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:32px 32px 8px;">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;line-height:1.3;color:#1E3A2A;">
            Your trial ends ${escapeHtml(when)}
          </h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#3F4A42;">
            Hi ${escapeHtml(greeting)}, your Longrein free trial for
            <strong>${escapeHtml(args.stableName)}</strong> ends ${escapeHtml(when)}.
          </p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#3F4A42;">
            You're one of our first founding stables — so your plan stays at
            <strong>50%, locked for life</strong> when you continue. Your data,
            calendar, horses and payments all stay exactly as they are.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto 20px;">
            <tr><td style="border-radius:8px;background:#1E3A2A;">
              <a href="${billingUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;">
                Keep my founding rate
              </a>
            </td></tr>
          </table>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#6E6760;">
            Questions before you decide? Just reply to this email — a real person reads it.
          </p>
        </td></tr>
        <tr><td style="padding:0 32px 32px;">${emailFooter()}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendEmail({
    to: args.to,
    subject,
    html,
    text,
    // One idempotency key per stable+milestone keeps Resend retries safe too.
    idempotencyKey: `trial-ending:${args.to}:${args.daysLeft}`,
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
