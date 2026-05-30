// lib/email/client-invite.ts
//
// Branded email sent when an owner clicks "Invite to app" on a client
// row. Recipient is the client, not the owner — wording assumes the
// reader knows their trainer but not Longrein.
//
// Brand voice: same as the other transactional emails — Linear/Stripe
// register, no exclamation marks, no "we're excited", no marketing.
//
// Failure semantics: caller catches. If the email send fails we still
// keep the invitation row so the owner can copy the link manually.

import { sendEmail, emailFooter } from "@/lib/email/send";

type SendClientInviteArgs = {
  /** Client's email — the To address. */
  to:           string;
  /** Display name for the greeting line. */
  clientName:   string;
  /** Stable / club name — appears in subject + body. */
  stableName:   string;
  /** Whoever clicked Invite, for the from-line in body. */
  inviterName:  string;
  /** Absolute URL the client clicks. https://app.longrein.eu/invite/<token>. */
  inviteUrl:    string;
  /** Stable brand colour (hex). Falls back to paddock-green when absent/invalid. */
  brandColor?:  string | null;
  /** Stable logo URL. Rendered in the header when present; else the stable name. */
  logoUrl?:     string | null;
};

export async function sendClientInviteEmail(args: SendClientInviteArgs): Promise<void> {
  const subject = `${args.stableName} invited you to Longrein`;

  // Per-stable brand: owners who set a colour/logo in Settings → Brand see
  // it applied here. Validate the hex so a bad value can't break the markup.
  const accent =
    args.brandColor && /^#[0-9a-fA-F]{6}$/.test(args.brandColor)
      ? args.brandColor
      : "#1E3A2A";
  const headerBlock = args.logoUrl
    ? `<img src="${args.logoUrl}" alt="${escapeHtml(args.stableName)}" height="40" style="height:40px;width:auto;display:block;margin:0 0 20px;">`
    : `<div style="font-size:15px;font-weight:600;color:${accent};margin:0 0 20px;">${escapeHtml(args.stableName)}</div>`;

  // Plain-text fallback first — improves inbox placement vs. HTML-only.
  const text = `Hi ${args.clientName},

${args.inviterName} from ${args.stableName} has invited you to their Longrein
client portal. You'll see your upcoming lessons, balances, and any horse
records they share with you.

Set up your account here (link expires in 14 days):
${args.inviteUrl}

If you didn't expect this email, ignore it — nothing happens.

— Longrein
longrein.eu`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(args.stableName)} invited you to Longrein</title>
</head>
<body style="margin:0;padding:0;background:#FAF8F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1E3A2A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAF8F4;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFFFF;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:32px 32px 8px;">
          ${headerBlock}
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;line-height:1.3;color:${accent};">
            ${escapeHtml(args.stableName)} invited you to Longrein
          </h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#3F4A42;">
            Hi ${escapeHtml(args.clientName)}, ${escapeHtml(args.inviterName)}
            set up a client portal account for you. You can see your upcoming
            lessons, balances, and shared horse records there.
          </p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#3F4A42;">
            Click the button to set your password and finish signing in.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 24px;">
            <tr><td style="border-radius:8px;background:${accent};">
              <a href="${args.inviteUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;">
                Accept invitation
              </a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#6E6760;">
            Or paste this link into your browser:
          </p>
          <p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:#1E3A2A;word-break:break-all;">
            <a href="${args.inviteUrl}" style="color:#1E3A2A;">${args.inviteUrl}</a>
          </p>
          <p style="margin:0;font-size:12px;line-height:1.5;color:#6E6760;">
            This invitation expires in 14 days. If you didn&apos;t expect this
            email, you can safely ignore it &mdash; the link only works once.
          </p>
        </td></tr>
        <tr><td style="padding:0 32px 32px;">
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
    // Idempotency key derived from the URL (which contains the unique
    // token), so a duplicate send within Resend's window won't double-fire.
    idempotencyKey: `client-invite:${args.inviteUrl}`,
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
