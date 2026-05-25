// lib/email/weather-alert.ts
//
// Sprint 4 "Equilab killer" #7 — daily weather alert email. Fires
// once per (stable, date, kind) when the next-24h forecast crosses
// a configured threshold. Audience: owners + employees only.

import { sendEmail, emailFooter } from "@/lib/email/send";

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.longrein.eu";

type SendWeatherAlertArgs = {
  to:           string;
  firstName:    string;
  stableName:   string;
  /** 'freeze' = low <= threshold; 'heat' = high >= threshold. */
  kind:         "freeze" | "heat";
  /** The threshold the staff configured (°C). */
  thresholdC:   number;
  /** The forecast value (°C) — low for freeze, high for heat. */
  forecastC:    number;
  /** Locale date label, e.g. "Sunday 1 June". */
  forDateLabel: string;
};

export async function sendWeatherAlertEmail(args: SendWeatherAlertArgs): Promise<void> {
  const greetingName = args.firstName.trim() || "team";
  const kindLabel    = args.kind === "freeze" ? "Freeze" : "Heat";
  const actionHint   = args.kind === "freeze"
    ? "Time to blanket, check water troughs for ice, and walk the paddock fences before dark."
    : "Time to plan early-morning rides, fly mask + fresh water, and shaded turnout windows.";

  const subject = `${kindLabel} alert — ${args.forecastC.toFixed(0)}°C ${args.forDateLabel.toLowerCase()}`;
  const settingsUrl = `${APP_URL}/dashboard/settings/hours`;

  const text = `Hi ${greetingName},

${kindLabel} alert for ${args.stableName} — forecast is ${args.forecastC.toFixed(0)}°C ${args.forDateLabel.toLowerCase()} (threshold ${args.thresholdC}°C).

${actionHint}

Adjust thresholds or pause alerts:
${settingsUrl}

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
            ${escapeHtml(kindLabel)} alert — ${escapeHtml(args.forecastC.toFixed(0))}°C ${escapeHtml(args.forDateLabel.toLowerCase())}.
          </h1>
          <p style="margin:0;font-size:13.5px;line-height:1.55;color:#6E6760;letter-spacing:.02em;text-transform:uppercase;font-weight:600;">
            ${escapeHtml(args.stableName)} · forecast
          </p>
        </td></tr>
        <tr><td style="padding:8px 32px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FBF7EF;border:1px solid #ECDFC9;border-radius:12px;">
            <tr><td style="padding:18px 20px;">
              <p style="margin:0 0 4px;font-size:11.5px;color:#8E867B;text-transform:uppercase;letter-spacing:.12em;font-weight:600;">
                Threshold ${escapeHtml(args.thresholdC.toString())}°C
              </p>
              <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:28px;color:#1E3A2A;line-height:1.1;letter-spacing:-.01em;font-weight:600;">
                ${escapeHtml(args.forecastC.toFixed(0))}°C ${escapeHtml(args.forDateLabel)}
              </p>
              <p style="margin:0;font-size:13.5px;color:#3F4A42;line-height:1.5;">
                ${escapeHtml(actionHint)}
              </p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 32px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="border-radius:8px;background:#1E3A2A;">
              <a href="${settingsUrl}" style="display:inline-block;padding:13px 22px;font-size:14.5px;font-weight:600;color:#F4ECDF;text-decoration:none;border-radius:8px;letter-spacing:.01em;">
                Adjust alert settings →
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
    idempotencyKey: `weather:${args.kind}:${args.forDateLabel}:${args.to}`,
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
