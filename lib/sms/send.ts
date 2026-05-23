// lib/sms/send.ts
//
// Thin Twilio Messages API wrapper — same shape as lib/email/send.ts
// so the cron reminder dispatcher can call sendEmail() or sendSMS()
// behind a single channel switch.
//
// Why fetch + Basic auth instead of `twilio` npm package:
//   * Edge-runtime compatible — no native deps to bundle.
//   * Twilio's REST API is stable and trivial to call directly.
//   * Saves ~50kB on every cold start vs the SDK.
//
// Failure semantics: throws on non-2xx so the caller (cron handler)
// can catch + log the row as `status='failed'` in reminder_dispatch_log.

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

export type SendSmsArgs = {
  to:   string;   // E.164 format ("+37061234567"). Caller is responsible for normalisation.
  body: string;
  /** Override the from-number. Defaults to TWILIO_FROM_PHONE env. */
  from?: string;
};

export type SendSmsResult = {
  /** Twilio Message SID — store in reminder_dispatch_log.provider_id. */
  sid:    string;
  status: string;
};

export async function sendSMS(args: SendSmsArgs): Promise<SendSmsResult> {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = args.from ?? process.env.TWILIO_FROM_PHONE;

  if (!sid || !token) {
    throw new Error("Twilio credentials not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)");
  }
  if (!from) {
    throw new Error("TWILIO_FROM_PHONE not configured");
  }
  if (!args.to.startsWith("+")) {
    throw new Error(`SMS recipient must be E.164 format, got: ${args.to}`);
  }
  if (args.body.length === 0) {
    throw new Error("SMS body cannot be empty");
  }
  // Single-segment SMS is 160 GSM-7 chars; we cap at 320 (2 segments)
  // to keep cost predictable. Longer should be email instead.
  if (args.body.length > 320) {
    throw new Error(`SMS body too long (${args.body.length} chars) — keep under 320`);
  }

  const url = `${TWILIO_API_BASE}/Accounts/${encodeURIComponent(sid)}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  const body = new URLSearchParams({
    From: from,
    To:   args.to,
    Body: args.body,
  });

  const res = await fetch(url, {
    method:  "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type":  "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "<no body>");
    throw new Error(`Twilio send failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { sid: string; status: string };
  return { sid: data.sid, status: data.status };
}

/**
 * Normalise a Lithuanian phone number to E.164 (`+370…`). Returns null
 * if the input doesn't look phone-shaped. The cron uses this on the
 * stored clients.phone before handing off to sendSMS().
 */
export function toE164Lithuania(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.replace(/[\s()\-]/g, "");
  if (trimmed.length === 0) return null;

  // Already E.164
  if (/^\+\d{8,15}$/.test(trimmed)) return trimmed;

  // Lithuanian local: 8 6XX XXX XX → +370 6XX…
  if (/^8\d{8}$/.test(trimmed)) return `+370${trimmed.slice(1)}`;

  // Lithuanian mobile bare: 6XX XXX XX → +370 6XX…
  if (/^6\d{7}$/.test(trimmed)) return `+370${trimmed}`;

  // Anything else — don't guess. Owner needs to fix in client record.
  return null;
}
