// lib/email/send.ts
//
// Generic Resend send helper. Use this for any new transactional
// email. lib/email/welcome.ts predates this and has its own fetch
// call — leave it alone; new templates use sendEmail() below.
//
// Why fetch and not the Resend SDK: edge-runtime compatibility.
// The waitlist signup runs at the edge (low latency), so the whole
// email layer stays SDK-free by design.
//
// Failure semantics: throws on non-2xx. Callers decide whether to
// swallow (e.g. nice-to-have welcome) or propagate (e.g. password
// reset — failing silently would lock the user out).

const RESEND_API_URL = "https://api.resend.com/emails";

export type SendEmailArgs = {
  to: string | string[];
  subject: string;
  html: string;
  /** Optional plain-text fallback. Strongly recommended for inbox placement. */
  text?: string;
  /** Override from address. Defaults to RESEND_FROM_*. */
  fromEmail?: string;
  fromName?: string;
  /** Set Reply-To. Defaults to fromEmail. */
  replyTo?: string;
  /** Per-Resend docs: idempotency key prevents accidental dupes on retry. */
  idempotencyKey?: string;
};

export async function sendEmail(args: SendEmailArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Same quiet-skip semantics as welcome.ts. Local dev without a
    // Resend key shouldn't blow up trial flows.
    console.warn("[email] RESEND_API_KEY not set — skipping send.");
    return;
  }

  const fromEmail = args.fromEmail ?? process.env.RESEND_FROM_EMAIL ?? "hello@longrein.eu";
  const fromName  = args.fromName  ?? process.env.RESEND_FROM_NAME  ?? "Longrein";

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type":  "application/json",
  };
  if (args.idempotencyKey) {
    headers["Idempotency-Key"] = args.idempotencyKey;
  }

  const payload = {
    from:       `${fromName} <${fromEmail}>`,
    to:         Array.isArray(args.to) ? args.to : [args.to],
    subject:    args.subject,
    html:       args.html,
    text:       args.text,
    reply_to:   args.replyTo ?? fromEmail,
  };

  const res = await fetch(RESEND_API_URL, {
    method:  "POST",
    headers,
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "<no body>");
    throw new Error(`Resend send failed (${res.status}): ${body}`);
  }
}

// Tiny helper for the "X — Longrein." footer used across all
// transactional emails. Brand voice: restrained, no marketing copy.
export function emailFooter(): string {
  return `<p style="font-size:12px;color:#6E6760;text-align:center;margin:24px 0 0;line-height:1.5;">
&copy; ${new Date().getFullYear()} Longrein &middot; Vilnius, Lithuania<br>
<a href="https://longrein.eu" style="color:#1E3A2A;text-decoration:none;">longrein.eu</a>
</p>`;
}
