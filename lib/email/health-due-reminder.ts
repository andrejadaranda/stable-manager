// lib/email/health-due-reminder.ts
//
// Sprint 4 "Equilab killer" #5 — vet/farrier/vaccination due-date
// reminder email. Fires 7, 3, and 1 day before
// horse_health_records.next_due_on, sent to every staff member (owner
// + employees) at the horse's stable. Branded to match the lesson
// reminder.
//
// We do NOT email the client / horse-owner here — they don't book
// the farrier or the vet. The audience is the operations team.

import { sendEmail, emailFooter } from "@/lib/email/send";

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.longrein.eu";

const KIND_LABEL: Record<string, string> = {
  vaccination: "Vaccination",
  farrier:     "Farrier visit",
  vet:         "Vet visit",
};

type SendHealthDueArgs = {
  /** Staff member email. */
  to:           string;
  /** First name for greeting. Falls back to "team". */
  firstName:    string;
  /** Horse display name. */
  horseName:    string;
  /** Record kind — 'vaccination' | 'farrier' | 'vet'. */
  kind:         "vaccination" | "farrier" | "vet";
  /** Record title (e.g. "Annual EHV-1 booster"). */
  title:        string;
  /** Localized due-date label, e.g. "Sunday 1 June". */
  dueDateLabel: string;
  /** Days from "now" to the due date — drives subject + tone (7 = heads up, 1 = today/tomorrow). */
  daysBefore:   1 | 3 | 7;
  /** Stable display name. */
  stableName:   string;
};

export async function sendHealthDueReminderEmail(args: SendHealthDueArgs): Promise<void> {
  const greetingName = args.firstName.trim() || "team";
  const kindLabel    = KIND_LABEL[args.kind] ?? args.kind;

  const urgencyWord =
    args.daysBefore === 1 ? "tomorrow"
    : args.daysBefore === 3 ? "in 3 days"
    : "next week";

  const subject = `${kindLabel} due ${urgencyWord} — ${args.horseName}`;
  const horseUrl = `${APP_URL}/dashboard/horses`;

  const text = `Hi ${greetingName},

Heads up — ${args.horseName} has a ${kindLabel.toLowerCase()} due ${urgencyWord} (${args.dueDateLabel}).

What's scheduled: ${args.title}

Open the horse's health log to mark it done, push the date, or add notes:
${horseUrl}

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
        <tr><td style="padding:28px 32px 4px;">
          <p style="margin:0;font-family:Georgia,serif;font-size:22px;color:#1E3A2A;letter-spacing:-.01em;">
            Longrein<span style="color:#B5793E;">.</span>
          </p>
        </td></tr>
        <tr><td style="padding:20px 32px 12px;">
          <h1 style="margin:0 0 6px;font-family:Georgia,serif;font-size:24px;font-weight:600;line-height:1.25;color:#1E3A2A;letter-spacing:-.01em;">
            ${escapeHtml(kindLabel)} due ${escapeHtml(urgencyWord)}.
          </h1>
          <p style="margin:0;font-size:13.5px;line-height:1.55;color:#6E6760;letter-spacing:.02em;text-transform:uppercase;font-weight:600;">
            Health log — ${escapeHtml(args.horseName)}
          </p>
        </td></tr>
        <tr><td style="padding:8px 32px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FBF7EF;border:1px solid #ECDFC9;border-radius:12px;">
            <tr><td style="padding:18px 20px;">
              <p style="margin:0 0 4px;font-size:11.5px;color:#8E867B;text-transform:uppercase;letter-spacing:.12em;font-weight:600;">
                ${escapeHtml(args.dueDateLabel)}
              </p>
              <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#1E3A2A;line-height:1.15;letter-spacing:-.01em;font-weight:600;">
                ${escapeHtml(args.title)}
              </p>
              <p style="margin:0;font-size:13.5px;color:#3F4A42;line-height:1.5;">
                ${escapeHtml(args.horseName)} · ${escapeHtml(args.stableName)}
              </p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 32px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="border-radius:8px;background:#1E3A2A;">
              <a href="${horseUrl}" style="display:inline-block;padding:13px 22px;font-size:14.5px;font-weight:600;color:#F4ECDF;text-decoration:none;border-radius:8px;letter-spacing:.01em;">
                Open horse health log →
              </a>
            </td></tr>
          </table>
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
    idempotencyKey: `health-due:${args.kind}:${args.daysBefore}:${args.horseName}:${args.dueDateLabel}:${args.to}`,
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
