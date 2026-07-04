// lib/email/owner-weekly-nudge.ts
//
// Weekly "money + welfare" nudge for the stable owner (+ employees).
// Sent Monday mornings by the reminders cron, and ONLY when there's
// something to act on — unpaid boarding this month and/or horses over
// their weekly lesson cap. Vet/farrier due-dates and client lesson
// reminders are handled elsewhere, so this deliberately does not repeat
// them (no inbox noise, no duplication).

import { sendEmail, emailFooter } from "@/lib/email/send";

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.longrein.eu";

const fmtEUR = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

type SendOwnerNudgeArgs = {
  to:                  string;
  firstName:           string;
  stableName:          string;
  /** Total unpaid/partial boarding across the stable (this + prior months). */
  unpaidBoardingTotal: number;
  /** How many boarding charges are outstanding. */
  unpaidBoardingCount: number;
  /** Horse names at or over their weekly lesson cap. */
  overCapHorses:       string[];
};

export async function sendOwnerWeeklyNudgeEmail(args: SendOwnerNudgeArgs): Promise<void> {
  const greeting = args.firstName.trim() || "there";
  const money = args.unpaidBoardingCount > 0;
  const welfare = args.overCapHorses.length > 0;

  const subjectBits: string[] = [];
  if (money) subjectBits.push(`${fmtEUR(args.unpaidBoardingTotal)} to collect`);
  if (welfare) subjectBits.push(`${args.overCapHorses.length} over cap`);
  const subject = `This week at ${args.stableName}: ${subjectBits.join(" · ")}`;

  const boardingUrl = `${APP_URL}/dashboard/settings/boarding`;
  const welfareUrl  = `${APP_URL}/dashboard/welfare`;

  const overCapList = args.overCapHorses.join(", ");

  const text = `Hi ${greeting},

Your Monday snapshot for ${args.stableName}:
${money ? `\n• Boarding: ${fmtEUR(args.unpaidBoardingTotal)} outstanding across ${args.unpaidBoardingCount} ${args.unpaidBoardingCount === 1 ? "charge" : "charges"}. Chase it: ${boardingUrl}` : ""}${welfare ? `\n• Welfare: ${args.overCapHorses.length} ${args.overCapHorses.length === 1 ? "horse is" : "horses are"} at/over the weekly cap — ${overCapList}. Review: ${welfareUrl}` : ""}

— Longrein
longrein.eu`;

  const moneyBlock = money ? `
        <tr><td style="padding:8px 32px 6px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FBF7EF;border:1px solid #ECDFC9;border-radius:12px;">
            <tr><td style="padding:18px 20px;">
              <p style="margin:0 0 4px;font-size:11.5px;color:#8E867B;text-transform:uppercase;letter-spacing:.12em;font-weight:600;">Boarding to collect</p>
              <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:26px;color:#1E3A2A;line-height:1.1;letter-spacing:-.01em;font-weight:600;">${fmtEUR(args.unpaidBoardingTotal)}</p>
              <p style="margin:0 0 12px;font-size:13.5px;color:#3F4A42;line-height:1.5;">${args.unpaidBoardingCount} outstanding ${args.unpaidBoardingCount === 1 ? "charge" : "charges"}.</p>
              <a href="${boardingUrl}" style="display:inline-block;padding:10px 18px;font-size:13.5px;font-weight:600;color:#F4ECDF;text-decoration:none;border-radius:8px;background:#1E3A2A;">See who owes →</a>
            </td></tr>
          </table>
        </td></tr>` : "";

  const welfareBlock = welfare ? `
        <tr><td style="padding:8px 32px 6px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FBF3F0;border:1px solid #F0D9D2;border-radius:12px;">
            <tr><td style="padding:18px 20px;">
              <p style="margin:0 0 4px;font-size:11.5px;color:#9A5C4A;text-transform:uppercase;letter-spacing:.12em;font-weight:600;">At / over weekly cap</p>
              <p style="margin:0 0 8px;font-size:14.5px;color:#3F4A42;line-height:1.5;font-weight:600;">${escapeHtml(overCapList)}</p>
              <a href="${welfareUrl}" style="display:inline-block;padding:10px 18px;font-size:13.5px;font-weight:600;color:#F4ECDF;text-decoration:none;border-radius:8px;background:#8A3E2A;">Open welfare board →</a>
            </td></tr>
          </table>
        </td></tr>` : "";

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#F4ECDF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1B1B1B;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4ECDF;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(30,42,71,.04),0 8px 32px rgba(30,42,71,.06);">
        <tr><td style="padding:28px 32px 4px;">
          <p style="margin:0;font-family:Georgia,serif;font-size:22px;color:#1E3A2A;letter-spacing:-.01em;">Longrein<span style="color:#B5793E;">.</span></p>
        </td></tr>
        <tr><td style="padding:20px 32px 4px;">
          <h1 style="margin:0 0 6px;font-family:Georgia,serif;font-size:24px;font-weight:600;line-height:1.25;color:#1E3A2A;letter-spacing:-.01em;">Your week at a glance.</h1>
          <p style="margin:0;font-size:13.5px;line-height:1.55;color:#6E6760;letter-spacing:.02em;text-transform:uppercase;font-weight:600;">${escapeHtml(args.stableName)}</p>
        </td></tr>
        ${moneyBlock}
        ${welfareBlock}
        <tr><td style="padding:14px 32px 28px;">${emailFooter()}</td></tr>
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
    idempotencyKey: `owner-weekly-nudge:${args.stableName}:${args.to}:${new Date().toISOString().slice(0, 10)}`,
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
