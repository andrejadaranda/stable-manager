// lib/email/welcome.ts
//
// Welcome email for waitlist signups on longrein.eu landing.
// Sends a brand-locked HTML email via Resend's REST API (fetch, no SDK)
// so this file remains edge-runtime compatible without adding deps.
//
// Called from app/api/waitlist/route.ts after a successful insert.
// Awaited (not fire-and-forget) because Edge runtime drops detached
// promises after the response returns. Wrapped in try/catch at the
// caller so a Resend failure never blocks the signup response.
//
// Brand voice: direct, not chatty. No "exciting!", "amazing!",
// "your journey begins!". Sit next to Linear / Stripe.
//
// Required env (already in .env.local; needs to also be in Vercel):
//   RESEND_API_KEY    — Resend "Sending access" key, prefix "re_"
//   RESEND_FROM_EMAIL — defaults to "hello@longrein.eu"
//   RESEND_FROM_NAME  — defaults to "Longrein"

const RESEND_API_URL = "https://api.resend.com/emails";

type WelcomeArgs = {
  email:    string;
  country?: string | null;
  yardSize?: string | null;
};

export async function sendWelcomeEmail(args: WelcomeArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // No key configured → quiet skip. Do not throw — keeps the signup
    // path green in environments where Resend isn't wired yet (preview
    // builds, local dev without secrets).
    console.warn("[welcome-email] RESEND_API_KEY not set — skipping send.");
    return;
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "hello@longrein.eu";
  const fromName  = process.env.RESEND_FROM_NAME  ?? "Longrein";

  const payload = {
    from:    `${fromName} <${fromEmail}>`,
    to:      [args.email],
    subject: "You're on the Longrein waitlist.",
    html:    welcomeHtml(),
    text:    welcomeText(),
  };

  const res = await fetch(RESEND_API_URL, {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "<no body>");
    throw new Error(`Resend send failed (${res.status}): ${body}`);
  }
}

function welcomeHtml(): string {
  // Inline <style> only — Gmail and Outlook strip <link rel=stylesheet>.
  // Colours from brand: paddock green #1E3A2A, saddle tan #B5793E,
  // arena cream #F4ECDF, ink #1B1B1B, muted #6E6760.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>You're on the Longrein waitlist</title>
<style>
body { margin: 0; padding: 0; background-color: #F4ECDF; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #1B1B1B; }
.wrapper { max-width: 560px; margin: 0 auto; padding: 32px 24px; }
.card { background: #FFFFFF; border-radius: 16px; padding: 32px 28px; box-shadow: 0 2px 8px rgba(30, 58, 42, 0.06); }
.wordmark { font-family: Georgia, "Times New Roman", serif; font-size: 22px; color: #1E3A2A; letter-spacing: -0.01em; margin: 0 0 20px; }
.wordmark .dot { color: #B5793E; }
h1 { font-family: Georgia, "Times New Roman", serif; font-size: 24px; line-height: 1.25; color: #1E3A2A; margin: 0 0 16px; letter-spacing: -0.01em; }
p { font-size: 15px; line-height: 1.55; color: #1B1B1B; margin: 0 0 14px; }
.muted { color: #6E6760; font-size: 13px; }
.footer { text-align: center; padding: 24px 0 0; color: #6E6760; font-size: 12px; line-height: 1.5; }
.footer a { color: #1E3A2A; text-decoration: none; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <p class="wordmark">Longrein<span class="dot">.</span></p>
    <h1>You're on the list.</h1>
    <p>Thanks for signing up. Longrein is a stable management tool built in Europe for riding schools and livery yards &mdash; calendar, horses, clients, invoicing, and welfare workload in one place.</p>
    <p>We open to the first ten yards as Founding Members on 23 May. The next note from us will tell you what's behind the door &mdash; feature walkthroughs, the offer, and how to step in if it's a fit.</p>
    <p class="muted">If you didn't sign up for this, ignore the email &mdash; your address won't be added to anything else.</p>
  </div>
  <div class="footer">
    &copy; 2026 Longrein &middot; Vilnius, Lithuania<br>
    <a href="https://longrein.eu">longrein.eu</a>
  </div>
</div>
</body>
</html>`;
}

function welcomeText(): string {
  return `You're on the list.

Thanks for signing up. Longrein is a stable management tool built in Europe for riding schools and livery yards — calendar, horses, clients, invoicing, and welfare workload in one place.

We open to the first ten yards as Founding Members on 23 May. The next note from us will tell you what's behind the door — feature walkthroughs, the offer, and how to step in if it's a fit.

If you didn't sign up for this, ignore the email — your address won't be added to anything else.

—
Longrein
https://longrein.eu`;
}
